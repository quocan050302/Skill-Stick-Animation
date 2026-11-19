"""Unit, signal-level, and negative tests for NEW SKILL-spec linear audio mixer."""

from __future__ import annotations

import json
import math
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "audio"))

import mix  # noqa: E402


class TestAudioMix(unittest.TestCase):
    def test_gated_rms_ignores_silent_pauses(self) -> None:
        sr = 48000
        t = np.arange(sr, dtype=np.float64) / sr
        active = 0.4 * np.sin(2.0 * np.pi * 440.0 * t)
        silent = np.zeros(sr, dtype=np.float64)
        combined = np.concatenate([active, silent])
        stats = mix.compute_gated_rms(combined, sample_rate=sr)
        expected_active_rms = 0.4 / math.sqrt(2.0)
        self.assertAlmostEqual(stats["gated_rms"], expected_active_rms, places=3)
        self.assertLess(stats["ungated_rms"], stats["gated_rms"] * 0.8)
        self.assertAlmostEqual(stats["active_window_ratio"], 0.5, places=2)

    def test_linear_minus_6db_ratio_no_ducking_and_peak_safety(self) -> None:
        vo, mus, sfx = mix.generate_synthetic_technical_fixture(duration_seconds=3.0, sample_rate=48000)
        mixed, metrics = mix.mix_linear_gated_rms(vo, mus, sfx, sample_rate=48000)

        self.assertFalse(metrics["dynamic_ducking"])
        self.assertTrue(metrics["all_samples_finite"])
        self.assertEqual(metrics["clipped_samples"], 0)
        self.assertLessEqual(metrics["final_peak"], metrics["master_peak_cap"] + 1e-6)
        self.assertLessEqual(metrics["sfx_peak_after_cap"], metrics["sfx_peak_cap"] + 1e-6)
        self.assertAlmostEqual(metrics["music_measured_ratio"], 0.5, delta=0.005)
        self.assertAlmostEqual(metrics["music_measured_db_rel_narration"], -6.0206, delta=0.1)
        self.assertEqual(mixed.shape, (3 * 48000, 2))

        # Verify NO dynamic ducking: music-only mix during silent narration gaps has identical RMS
        # to music-only during active narration windows.
        music_only_scaled = np.repeat(mus, 2, axis=1) * metrics["music_linear_gain"]
        rms_window_silent = float(np.sqrt(np.mean(music_only_scaled[: int(0.14 * 48000)] ** 2)))
        rms_window_active = float(np.sqrt(np.mean(music_only_scaled[int(0.20 * 48000) : int(0.75 * 48000)] ** 2)))
        self.assertAlmostEqual(rms_window_silent, rms_window_active, delta=0.01)

    def test_cli_roundtrip_wav(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            d = Path(td)
            vo, mus, sfx = mix.generate_synthetic_technical_fixture(duration_seconds=2.0, sample_rate=48000)
            vo_p = mix.write_wav_pcm16(d / "vo.wav", vo, 48000)
            mus_p = mix.write_wav_pcm16(d / "mus.wav", mus, 48000)
            sfx_p = mix.write_wav_pcm16(d / "sfx.wav", sfx, 48000)
            out_p = d / "mixed.wav"

            proc = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "tools" / "audio" / "mix.py"),
                    "--narration",
                    str(vo_p),
                    "--music",
                    str(mus_p),
                    "--sfx",
                    str(sfx_p),
                    "--out",
                    str(out_p),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)
            metrics = json.loads(proc.stdout)
            self.assertAlmostEqual(metrics["music_measured_ratio"], 0.5, delta=0.01)
            loaded, sr = mix.read_wav_float(out_p)
            self.assertEqual(sr, 48000)
            self.assertEqual(loaded.shape, (96000, 2))

    def test_negative_audio_cases(self) -> None:
        # Silent narration rejected
        with self.assertRaises(mix.AudioContractError):
            mix.mix_linear_gated_rms(np.zeros((48000, 1)), np.ones((48000, 1)) * 0.1)

        # NaN sample rejected
        bad = np.ones((1000, 1), dtype=np.float64) * 0.2
        bad[10, 0] = np.nan
        with self.assertRaises(mix.AudioContractError):
            mix.mix_linear_gated_rms(bad)

        # Inf sample rejected
        bad_inf = np.ones((1000, 1), dtype=np.float64) * 0.2
        bad_inf[10, 0] = np.inf
        with self.assertRaises(mix.AudioContractError):
            mix.mix_linear_gated_rms(bad_inf)

        # Missing WAV file rejected
        with self.assertRaises(FileNotFoundError):
            mix.read_wav_float(ROOT / "workspace" / "does-not-exist-voice.wav")


if __name__ == "__main__":
    unittest.main()
