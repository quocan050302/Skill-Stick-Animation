"""Safe path handling, atomic writes, workspace confinement, and disk preflight guards.

Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01).
"""

from __future__ import annotations

import os
import re
import shutil
import tempfile
from pathlib import Path
from typing import Any


SAFE_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
DEFAULT_LOW_WATERMARK_MB = 2048


class PathSecurityError(ValueError):
    """Raised when a path escapes its allowed root or uses unsafe syntax."""


class DiskSpaceError(RuntimeError):
    """Raised when available disk space violates the low-watermark policy."""


def validate_safe_filename(name: str) -> str:
    """Validate a single filename component without path separators or traversal."""
    if not name or "/" in name or "\\" in name or name in (".", ".."):
        raise PathSecurityError(f"Unsafe filename: {name!r}")
    if not SAFE_NAME_RE.match(name):
        raise PathSecurityError(f"Filename contains disallowed characters: {name!r}")
    return name


def resolve_confined(root: Path | str, relative_path: Path | str) -> Path:
    """Resolve relative_path inside root and reject traversal, drive letters, or escapes."""
    root_path = Path(root).resolve()
    raw = str(relative_path)

    if not raw or "\x00" in raw:
        raise PathSecurityError(f"Empty or null-byte path rejected: {raw!r}")

    normalized = raw.replace("\\", "/")
    if normalized.startswith("/") or re.match(r"^[A-Za-z]:", normalized):
        raise PathSecurityError(f"Absolute or drive-qualified path rejected: {raw!r}")

    parts = [p for p in normalized.split("/") if p]
    if any(p in (".", "..") for p in parts):
        raise PathSecurityError(f"Path traversal component rejected: {raw!r}")

    candidate = (root_path / Path(*parts)).resolve()
    try:
        candidate.relative_to(root_path)
    except ValueError as exc:
        raise PathSecurityError(
            f"Resolved path {candidate} escapes root {root_path}"
        ) from exc
    return candidate


def safe_rmtree(target: Path | str, allowed_parent: Path | str) -> None:
    """Delete target ONLY if it is strictly nested inside allowed_parent (never root itself)."""
    parent_resolved = Path(allowed_parent).resolve()
    target_resolved = Path(target).resolve()

    if target_resolved == parent_resolved:
        raise PathSecurityError(
            f"Refusing to delete workspace root itself: {target_resolved}"
        )
    try:
        target_resolved.relative_to(parent_resolved)
    except ValueError as exc:
        raise PathSecurityError(
            f"Refusing to delete path outside allowed workspace: {target_resolved} not in {parent_resolved}"
        ) from exc

    if target_resolved.exists():
        shutil.rmtree(target_resolved)


def atomic_write_bytes(dest: Path | str, data: bytes) -> Path:
    """Write bytes to a project-local sibling temp file and atomically replace dest."""
    dest_path = Path(dest).resolve()
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{dest_path.name}.",
        suffix=".tmp",
        dir=str(dest_path.parent),
    )
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_path, dest_path)
        return dest_path
    except Exception:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass
        raise


def atomic_write_text(dest: Path | str, text: str, encoding: str = "utf-8") -> Path:
    """Atomically write UTF-8 text to dest."""
    return atomic_write_bytes(dest, text.encode(encoding))


def check_disk_space(
    path: Path | str,
    estimated_needed_bytes: int = 0,
    low_watermark_mb: int = DEFAULT_LOW_WATERMARK_MB,
) -> dict[str, Any]:
    """Verify free disk space satisfies estimated render needs plus low-watermark reserve."""
    target = Path(path).resolve()
    probe = target if target.exists() else target.parent
    while not probe.exists() and probe != probe.parent:
        probe = probe.parent

    usage = shutil.disk_usage(probe)
    watermark_bytes = int(low_watermark_mb) * 1024 * 1024
    required_bytes = max(0, int(estimated_needed_bytes)) + watermark_bytes
    free_after_bytes = usage.free - max(0, int(estimated_needed_bytes))
    ok = usage.free >= required_bytes

    report = {
        "probe_path": str(probe),
        "total_bytes": usage.total,
        "used_bytes": usage.used,
        "free_bytes": usage.free,
        "free_mb": round(usage.free / (1024 * 1024), 2),
        "estimated_needed_bytes": max(0, int(estimated_needed_bytes)),
        "low_watermark_mb": int(low_watermark_mb),
        "required_bytes": required_bytes,
        "free_after_mb": round(free_after_bytes / (1024 * 1024), 2),
        "ok": ok,
    }
    if not ok:
        raise DiskSpaceError(
            f"Insufficient disk space at {probe}: free={report['free_mb']} MB, "
            f"need >= {round(required_bytes / (1024 * 1024), 2)} MB "
            f"(estimated={round(max(0, estimated_needed_bytes)/(1024*1024), 2)} MB + "
            f"watermark={low_watermark_mb} MB)."
        )
    return report
