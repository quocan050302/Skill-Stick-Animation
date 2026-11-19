"""Unit & negative tests for safe path containment, atomic writes, and disk preflight."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "setup"))

import safe_path  # noqa: E402


class TestSafePathAndDisk(unittest.TestCase):
    def test_safe_filename_validation(self) -> None:
        self.assertEqual(safe_path.validate_safe_filename("frame_000001.png"), "frame_000001.png")
        for bad in ("", ".", "..", "../a.png", "a/b.png", "a\\b.png", "bad name?.png"):
            with self.assertRaises(safe_path.PathSecurityError):
                safe_path.validate_safe_filename(bad)

    def test_resolve_confined_accepts_nested_and_rejects_escape(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            ok = safe_path.resolve_confined(root, "sub/dir/file.txt")
            self.assertEqual(ok, (root / "sub" / "dir" / "file.txt").resolve())

            for bad in ("../outside.txt", "/abs/path", "C:\\Windows\\system.ini", "a/../b", "x\x00y"):
                with self.assertRaises(safe_path.PathSecurityError):
                    safe_path.resolve_confined(root, bad)

    def test_safe_rmtree_blocks_root_and_external_paths(self) -> None:
        with tempfile.TemporaryDirectory() as td1, tempfile.TemporaryDirectory() as td2:
            root = Path(td1)
            outside = Path(td2)
            nested = root / "job-1"
            nested.mkdir()
            (nested / "tmp.txt").write_text("hi", encoding="utf-8")

            with self.assertRaises(safe_path.PathSecurityError):
                safe_path.safe_rmtree(root, root)
            with self.assertRaises(safe_path.PathSecurityError):
                safe_path.safe_rmtree(outside, root)

            safe_path.safe_rmtree(nested, root)
            self.assertFalse(nested.exists())

    def test_atomic_write_bytes_and_replace(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            target = Path(td) / "nested" / "out.bin"
            safe_path.atomic_write_bytes(target, b"first")
            self.assertEqual(target.read_bytes(), b"first")
            safe_path.atomic_write_bytes(target, b"second")
            self.assertEqual(target.read_bytes(), b"second")
            self.assertEqual(list(target.parent.glob("*.tmp")), [])

    def test_disk_preflight_pass_and_low_space_negative(self) -> None:
        report = safe_path.check_disk_space(ROOT, estimated_needed_bytes=1024, low_watermark_mb=10)
        self.assertTrue(report["ok"])
        self.assertGreater(report["free_mb"], 10.0)

        # Impossibly high watermark must trigger DiskSpaceError cleanly
        with self.assertRaises(safe_path.DiskSpaceError):
            safe_path.check_disk_space(
                ROOT,
                estimated_needed_bytes=10**16,
                low_watermark_mb=1024,
            )


if __name__ == "__main__":
    unittest.main()
