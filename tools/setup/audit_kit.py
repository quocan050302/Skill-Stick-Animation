"""Phase 0 & Phase 1 Forensic ZIP Auditor and Byte-Identical Preserver.

Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01).

Safety guarantees:
- Inspects ZIP archive before extracting any bytes.
- Rejects path traversal, absolute paths, drive prefixes, symlinks, duplicate entries,
  excessive compression ratios, and uncompressed size bombs.
- Extracts into an isolated project-owned temp directory (never global /tmp).
- Records CRC32, byte size, and SHA-256 per file and checks byte-identical copy fidelity.
- Checks for identifiable LICENSE files to enforce the G05 Public Repo Licensing Gate.
- Reports INPUT_BLOCKED honestly when required inputs are absent.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import sys
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from safe_path import PathSecurityError, atomic_write_text, resolve_confined, safe_rmtree


MAX_UNCOMPRESSED_TOTAL_BYTES = 250 * 1024 * 1024  # 250 MiB ceiling for kit archives
MAX_SINGLE_FILE_BYTES = 64 * 1024 * 1024          # 64 MiB ceiling per entry
MAX_COMPRESSION_RATIO = 100.0                     # zip-bomb ratio threshold

EXPECTED_KIT_ENTRIES = [
    "cartoon-short-kit/README.md",
    "cartoon-short-kit/engine/index.html",
    "cartoon-short-kit/engine/main.js",
    "cartoon-short-kit/engine/motion.js",
    "cartoon-short-kit/engine/paint.js",
    "cartoon-short-kit/engine/roman.js",
    "cartoon-short-kit/example/soldier/stills.jpg",
    "cartoon-short-kit/example/soldier/story.js",
    "cartoon-short-kit/example/soldier/audio.py",
    "cartoon-short-kit/tools/setup.sh",
    "cartoon-short-kit/tools/timing.py",
    "cartoon-short-kit/tools/render.mjs",
    "cartoon-short-kit/tools/sheet.py",
    "cartoon-short-kit/tools/finish.sh",
]

FILE_ROLES = {
    "README.md": "kit_documentation",
    "engine/index.html": "webgl_host_page",
    "engine/main.js": "threejs_renderer_core",
    "engine/motion.js": "camera_and_motion_helpers",
    "engine/paint.js": "procedural_texture_generator",
    "engine/roman.js": "character_pen_drawing_module",
    "example/soldier/stills.jpg": "reference_contact_sheet",
    "example/soldier/story.js": "reference_soldier_story",
    "example/soldier/audio.py": "reference_audio_synthesis",
    "tools/setup.sh": "upstream_setup_script",
    "tools/timing.py": "voice_timing_alignment",
    "tools/render.mjs": "playwright_frame_capture",
    "tools/sheet.py": "contact_sheet_builder",
    "tools/finish.sh": "ffmpeg_finish_pipeline",
}

LICENSE_NAME_RE = re.compile(r"(^|/)(license|copying|notice)(\.[a-z0-9]+)?$", re.IGNORECASE)


class ZipAuditError(ValueError):
    """Raised when a ZIP archive fails security or integrity validation."""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _is_symlink_info(info: zipfile.ZipInfo) -> bool:
    mode = info.external_attr >> 16
    return stat.S_ISLNK(mode)


def _normalize_zip_path(filename: str) -> str:
    if "\x00" in filename:
        raise ZipAuditError(f"Null byte in ZIP entry name: {filename!r}")
    norm = filename.replace("\\", "/")
    if norm.startswith("/") or re.match(r"^[A-Za-z]:", norm):
        raise ZipAuditError(f"Absolute path in ZIP entry rejected: {filename!r}")
    parts = [p for p in norm.split("/") if p]
    if any(p in (".", "..") for p in parts):
        raise ZipAuditError(f"Path traversal in ZIP entry rejected: {filename!r}")
    return "/".join(parts) + ("/" if norm.endswith("/") else "")


def inspect_zip_archive(
    zip_path: Path,
    max_total_bytes: int = MAX_UNCOMPRESSED_TOTAL_BYTES,
    max_file_bytes: int = MAX_SINGLE_FILE_BYTES,
    max_ratio: float = MAX_COMPRESSION_RATIO,
) -> dict[str, Any]:
    """Perform full security and integrity audit of a ZIP archive without extracting."""
    if not zip_path.exists():
        raise FileNotFoundError(f"ZIP archive not found: {zip_path}")
    if not zipfile.is_zipfile(zip_path):
        raise ZipAuditError(f"Not a valid ZIP archive: {zip_path}")

    seen_paths: set[str] = set()
    entries: list[dict[str, Any]] = []
    license_files: list[str] = []
    total_uncompressed = 0
    total_compressed = 0

    with zipfile.ZipFile(zip_path, "r") as zf:
        bad_member = zf.testzip()
        if bad_member is not None:
            raise ZipAuditError(f"Corrupt ZIP CRC detected in member: {bad_member}")

        for info in zf.infolist():
            norm = _normalize_zip_path(info.filename)
            if not norm:
                raise ZipAuditError("Empty normalized ZIP entry path")
            if norm in seen_paths:
                raise ZipAuditError(f"Duplicate ZIP entry rejected: {norm!r}")
            seen_paths.add(norm)

            if _is_symlink_info(info):
                raise ZipAuditError(f"Symlink ZIP entry rejected: {info.filename!r}")

            if info.file_size > max_file_bytes:
                raise ZipAuditError(
                    f"Single ZIP entry exceeds size limit ({info.file_size} > {max_file_bytes}): {norm}"
                )

            total_uncompressed += info.file_size
            total_compressed += info.compress_size
            if total_uncompressed > max_total_bytes:
                raise ZipAuditError(
                    f"Total uncompressed size exceeds limit ({total_uncompressed} > {max_total_bytes})"
                )

            if info.compress_size > 0:
                ratio = info.file_size / info.compress_size
                if ratio > max_ratio and info.file_size > 1024 * 1024:
                    raise ZipAuditError(
                        f"Suspicious zip-bomb compression ratio ({ratio:.1f}x > {max_ratio}x): {norm}"
                    )

            is_dir = info.is_dir() or norm.endswith("/")
            entry_sha256 = None
            if not is_dir:
                raw = zf.read(info)
                if len(raw) != info.file_size:
                    raise ZipAuditError(
                        f"Byte size mismatch for {norm}: header={info.file_size}, read={len(raw)}"
                    )
                entry_sha256 = sha256_bytes(raw)
                if LICENSE_NAME_RE.search(norm):
                    license_files.append(norm)

            entries.append(
                {
                    "archive_path": norm,
                    "is_dir": is_dir,
                    "crc32": f"{info.CRC:08x}",
                    "compressed_size_bytes": info.compress_size,
                    "original_size_bytes": info.file_size,
                    "source_sha256": entry_sha256,
                }
            )

    file_paths = {e["archive_path"] for e in entries if not e["is_dir"]}
    missing_expected = [p for p in EXPECTED_KIT_ENTRIES if p not in file_paths]

    return {
        "zip_path": str(zip_path),
        "zip_size_bytes": zip_path.stat().st_size,
        "zip_sha256": sha256_file(zip_path),
        "entry_count": len(entries),
        "file_count": sum(1 for e in entries if not e["is_dir"]),
        "dir_count": sum(1 for e in entries if e["is_dir"]),
        "total_compressed_bytes": total_compressed,
        "total_uncompressed_bytes": total_uncompressed,
        "license_files_found": license_files,
        "package_license_verified": len(license_files) > 0,
        "missing_expected_entries": missing_expected,
        "entries": entries,
    }


def _classify_role(archive_path: str) -> str:
    stripped = archive_path
    if stripped.startswith("cartoon-short-kit/"):
        stripped = stripped[len("cartoon-short-kit/"):]
    return FILE_ROLES.get(stripped, "kit_auxiliary_file")


def safe_extract_and_preserve(
    zip_path: Path,
    project_root: Path,
    preserve_dir: Path | None = None,
    license_status: str = "UNVERIFIED_RESTRICTED_LOCAL_ONLY",
) -> dict[str, Any]:
    """Audit, extract into project-owned temp dir, preserve byte-for-byte, and verify SHA-256."""
    audit = inspect_zip_archive(zip_path)
    workspace_cache = project_root / "workspace" / "cache"
    workspace_cache.mkdir(parents=True, exist_ok=True)
    isolated_tmp = workspace_cache / f"kit-extract-{uuid.uuid4().hex[:10]}"
    isolated_tmp.mkdir(parents=True, exist_ok=False)

    manifest_files: list[dict[str, Any]] = []
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            for entry in audit["entries"]:
                if entry["is_dir"]:
                    continue
                rel = entry["archive_path"]
                extracted_dest = resolve_confined(isolated_tmp, rel)
                extracted_dest.parent.mkdir(parents=True, exist_ok=True)
                raw = zf.read(rel)
                extracted_dest.write_bytes(raw)
                extracted_hash = sha256_file(extracted_dest)
                if extracted_hash != entry["source_sha256"]:
                    raise ZipAuditError(f"Extraction hash mismatch for {rel}")

                copied_path_str = None
                copied_hash = None
                match_bool = False
                if preserve_dir is not None:
                    copied_dest = resolve_confined(preserve_dir, rel)
                    copied_dest.parent.mkdir(parents=True, exist_ok=True)
                    copied_dest.write_bytes(raw)
                    copied_hash = sha256_file(copied_dest)
                    match_bool = copied_hash == entry["source_sha256"]
                    if not match_bool:
                        raise ZipAuditError(f"Preserved copy hash mismatch for {rel}")
                    copied_path_str = str(copied_dest.relative_to(project_root)).replace("\\", "/")

                manifest_files.append(
                    {
                        "source_zip_filename": zip_path.name,
                        "extracted_original_path": rel,
                        "copied_path": copied_path_str,
                        "crc32": entry["crc32"],
                        "source_sha256": entry["source_sha256"],
                        "copied_sha256": copied_hash,
                        "match_boolean": match_bool,
                        "original_size_bytes": entry["original_size_bytes"],
                        "file_role": _classify_role(rel),
                        "license_status": (
                            "LICENSE_FILE_FOUND_REQUIRES_REVIEW"
                            if audit["package_license_verified"]
                            else license_status
                        ),
                        "runtime_adapter_or_patch_path": None,
                        "QA_evidence_path": None,
                    }
                )
    finally:
        safe_rmtree(isolated_tmp, workspace_cache)

    return {
        "status": "PRESERVED_VERIFIED",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "archive_audit": {k: v for k, v in audit.items() if k != "entries"},
        "files": manifest_files,
        "all_hashes_match": all(f["match_boolean"] for f in manifest_files) if preserve_dir else False,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Forensic ZIP auditor for cartoon-short-kit.zip")
    parser.add_argument(
        "--project-root",
        default=".",
        help="Repository root directory (default: current directory)",
    )
    parser.add_argument(
        "--zip",
        dest="zip_path",
        default="_inputs/cartoon-short-kit.zip",
        help="Path to cartoon-short-kit.zip",
    )
    parser.add_argument(
        "--skill-md",
        dest="skill_md_path",
        default="_inputs/Pasted markdown.md",
        help="Path to Pasted markdown.md containing cartoon-audio-short SKILL.md",
    )
    parser.add_argument(
        "--preserve",
        action="store_true",
        help="Preserve verified byte-identical files into vendor/cartoon-short-kit (local-only until G05 passes)",
    )
    parser.add_argument(
        "--write-manifest",
        action="store_true",
        help="Write docs/SOURCE_FIDELITY_MANIFEST.json and vendor/source-manifest.json",
    )
    args = parser.parse_args(argv)

    root = Path(args.project_root).resolve()
    zip_p = Path(args.zip_path) if os.path.isabs(args.zip_path) else (root / args.zip_path)
    skill_p = Path(args.skill_md_path) if os.path.isabs(args.skill_md_path) else (root / args.skill_md_path)

    missing = []
    if not zip_p.exists():
        missing.append(str(zip_p))
    if not skill_p.exists():
        missing.append(str(skill_p))

    if missing:
        blocked = {
            "status": "INPUT_BLOCKED",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "missing_required_inputs": missing,
            "expected_zip_entries": EXPECTED_KIT_ENTRIES,
            "license_gate_g05": "BLOCKED",
            "files": [],
        }
        print(json.dumps(blocked, indent=2))
        if args.write_manifest:
            payload = json.dumps(blocked, indent=2) + "\n"
            atomic_write_text(root / "docs" / "SOURCE_FIDELITY_MANIFEST.json", payload)
            atomic_write_text(root / "vendor" / "source-manifest.json", payload)
        return 2

    preserve_dir = (root / "vendor") if args.preserve else None
    result = safe_extract_and_preserve(zip_p, root, preserve_dir=preserve_dir)
    result["skill_markdown"] = {
        "path": str(skill_p),
        "size_bytes": skill_p.stat().st_size,
        "sha256": sha256_file(skill_p),
    }
    print(json.dumps(result, indent=2))

    if args.write_manifest:
        payload = json.dumps(result, indent=2) + "\n"
        atomic_write_text(root / "docs" / "SOURCE_FIDELITY_MANIFEST.json", payload)
        atomic_write_text(root / "vendor" / "source-manifest.json", payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
