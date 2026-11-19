"""Unit & negative tests for Phase 0/1 forensic ZIP auditor (tools/setup/audit_kit.py)."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "setup"))

import audit_kit  # noqa: E402


def _make_valid_kit_zip(dest: Path) -> dict[str, bytes]:
    payloads = {
        "cartoon-short-kit/README.md": b"# Demo kit fixture\n",
        "cartoon-short-kit/engine/index.html": b"<!doctype html><canvas></canvas>\n",
        "cartoon-short-kit/engine/main.js": b"export const ok = true;\n",
    }
    with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("cartoon-short-kit/", b"")
        zf.writestr("cartoon-short-kit/engine/", b"")
        for name, data in payloads.items():
            zf.writestr(name, data)
    return payloads


class TestAuditKit(unittest.TestCase):
    def test_valid_zip_audit_and_byte_identical_preservation(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            zip_path = root / "fixture-kit.zip"
            payloads = _make_valid_kit_zip(zip_path)

            audit = audit_kit.inspect_zip_archive(zip_path)
            self.assertEqual(audit["file_count"], 3)
            self.assertFalse(audit["package_license_verified"])
            self.assertTrue(len(audit["missing_expected_entries"]) > 0)

            res = audit_kit.safe_extract_and_preserve(
                zip_path, root, preserve_dir=root / "vendor"
            )
            self.assertTrue(res["all_hashes_match"])
            self.assertEqual(len(res["files"]), 3)
            for item in res["files"]:
                self.assertTrue(item["match_boolean"])
                self.assertEqual(item["source_sha256"], item["copied_sha256"])
                copied = root / item["copied_path"]
                self.assertEqual(copied.read_bytes(), payloads[item["extracted_original_path"]])
            # Isolated temp directory must have been cleaned up
            cache_dir = root / "workspace" / "cache"
            self.assertEqual(list(cache_dir.glob("kit-extract-*")), [])

    def test_rejects_path_traversal_zip(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            zp = Path(td) / "traversal.zip"
            with zipfile.ZipFile(zp, "w") as zf:
                zf.writestr("../escape.js", b"evil")
            with self.assertRaises(audit_kit.ZipAuditError):
                audit_kit.inspect_zip_archive(zp)

    def test_rejects_absolute_and_drive_paths(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            for bad_name in ("/etc/passwd", "C:/Windows/win.ini"):
                zp = Path(td) / "abs.zip"
                with zipfile.ZipFile(zp, "w") as zf:
                    zf.writestr(bad_name, b"nope")
                with self.assertRaises(audit_kit.ZipAuditError):
                    audit_kit.inspect_zip_archive(zp)

    def test_rejects_symlink_entry(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            zp = Path(td) / "symlink.zip"
            with zipfile.ZipFile(zp, "w") as zf:
                info = zipfile.ZipInfo("cartoon-short-kit/link.js")
                info.external_attr = (0o120777 << 16)
                zf.writestr(info, b"/etc/hosts")
            with self.assertRaises(audit_kit.ZipAuditError):
                audit_kit.inspect_zip_archive(zp)

    def test_rejects_duplicate_entries(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            zp = Path(td) / "dup.zip"
            with zipfile.ZipFile(zp, "w") as zf:
                zf.writestr("cartoon-short-kit/a.js", b"1")
                zf.writestr("cartoon-short-kit/a.js", b"2")
            with self.assertRaises(audit_kit.ZipAuditError):
                audit_kit.inspect_zip_archive(zp)

    def test_rejects_corrupt_and_non_zip(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            bad = Path(td) / "notazip.zip"
            bad.write_bytes(b"definitely not a zip file")
            with self.assertRaises(audit_kit.ZipAuditError):
                audit_kit.inspect_zip_archive(bad)

    def test_rejects_zip_bomb_ratio(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            zp = Path(td) / "bomb.zip"
            with zipfile.ZipFile(zp, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                zf.writestr("cartoon-short-kit/zeros.bin", b"\x00" * (2 * 1024 * 1024))
            with self.assertRaises(audit_kit.ZipAuditError):
                audit_kit.inspect_zip_archive(zp, max_ratio=50.0)

    def test_cli_reports_input_blocked_when_missing(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            proc = subprocess.run(
                [sys.executable, str(ROOT / "tools" / "setup" / "audit_kit.py"), "--project-root", td],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(proc.returncode, 2)
            payload = json.loads(proc.stdout)
            self.assertEqual(payload["status"], "INPUT_BLOCKED")
            self.assertEqual(payload["license_gate_g05"], "BLOCKED")
            self.assertEqual(len(payload["missing_required_inputs"]), 2)


if __name__ == "__main__":
    unittest.main()
