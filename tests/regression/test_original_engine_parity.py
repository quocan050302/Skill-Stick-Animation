"""Regression & backtest verification suite for original cartoon-short-kit baseline.

Runs when preserved local kit (vendor/cartoon-short-kit/) is present.
Verifies:
1. Original source byte integrity unchanged vs docs/SOURCE_FIDELITY_MANIFEST.json (14/14 SHA-256).
2. Original audio.py baseline vs NEW tools/audio/mix.py divergence explicitly verified.
3. Rendered Soldier Frame 0 matches Tile 0 of reference example/soldier/stills.jpg semantically
   (independent backtest comparison of matched 270x480 tile, reporting objective MAE without
   fabricating scores for unmatched tiles).
"""

from __future__ import annotations

import hashlib
import json
import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "audio"))
sys.path.insert(0, str(ROOT / "tools" / "qa"))


def sha256_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


class TestOriginalEngineRegressionAndBacktest(unittest.TestCase):
    def setUp(self) -> None:
        self.kit_dir = ROOT / "vendor" / "cartoon-short-kit"
        self.manifest_path = ROOT / "docs" / "SOURCE_FIDELITY_MANIFEST.json"

    def test_preserved_original_source_byte_integrity_unchanged(self) -> None:
        if not self.kit_dir.exists():
            self.skipTest("Local vendor/cartoon-short-kit not present (G05 local-only)")
        manifest = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(manifest["status"], "PRESERVED_VERIFIED")
        self.assertEqual(len(manifest["files"]), 14)
        for item in manifest["files"]:
            fp = ROOT / item["copied_path"]
            self.assertTrue(fp.exists(), f"Missing preserved file: {fp}")
            actual_hash = sha256_file(fp)
            self.assertEqual(actual_hash, item["source_sha256"], f"Byte drift detected in {fp}")
            self.assertEqual(fp.stat().st_size, item["original_size_bytes"])

    def test_backtest_soldier_frame0_against_reference_stills_tile0(self) -> None:
        ref_stills = self.kit_dir / "example" / "soldier" / "stills.jpg"
        our_frame0 = ROOT / "workspace" / "cache" / "soldier-stills" / "frame_000000.jpg"
        if not ref_stills.exists() or not our_frame0.exists():
            self.skipTest("Local Soldier stills or reference not present")

        # Reference stills.jpg is a 7x2 grid of 270x480 tiles (tile 0 = top-left 270x480 = hook MCU frame 0/5)
        with Image.open(ref_stills) as ref_im:
            self.assertEqual(ref_im.size, (1890, 960))
            ref_tile0 = np.asarray(ref_im.crop((0, 0, 270, 480)).convert("RGB"), dtype=np.float32)

        with Image.open(our_frame0) as our_im:
            self.assertEqual(our_im.size, (1080, 1920))
            our_tile0 = np.asarray(our_im.resize((270, 480), Image.Resampling.LANCZOS).convert("RGB"), dtype=np.float32)

        # Cross-OS/GPU/font/frame-index tolerance: tile 0 in reference may be frame 0..5, so check
        # strong color/structural agreement (mean channel diff & coarse histogram correlation > 0.90)
        mae = float(np.mean(np.abs(ref_tile0 - our_tile0)))
        hist_ref = np.histogram(ref_tile0.ravel(), bins=32, range=(0, 256))[0].astype(np.float64)
        hist_our = np.histogram(our_tile0.ravel(), bins=32, range=(0, 256))[0].astype(np.float64)
        corr = float(np.corrcoef(hist_ref, hist_our)[0, 1])

        self.assertLess(mae, 25.0, f"Matched Tile 0 MAE too high: {mae:.2f}")
        self.assertGreater(corr, 0.92, f"Matched Tile 0 luminance/color correlation too low: {corr:.4f}")

    def test_soldier_audio_baseline_vs_skill_spec_divergence_documented(self) -> None:
        audit_path = ROOT / "workspace" / "cache" / "soldier-audio-audit.json"
        if not audit_path.exists():
            self.skipTest("Local soldier-audio-audit.json not generated")
        data = json.loads(audit_path.read_text(encoding="utf-8"))
        self.assertTrue(data["config_a_original_audio_py"]["dynamic_ducking_present"])
        self.assertFalse(data["config_b_new_skill_spec_mix_py"]["dynamic_ducking"])
        self.assertAlmostEqual(data["config_b_new_skill_spec_mix_py"]["music_measured_ratio"], 0.5, delta=0.01)


if __name__ == "__main__":
    unittest.main()
