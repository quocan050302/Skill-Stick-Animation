"""Unit & negative tests for timing and duration->frame contract."""

from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "timing"))

import timing_contract  # noqa: E402


class TestTimingContract(unittest.TestCase):
    def test_expected_frame_count(self) -> None:
        self.assertEqual(timing_contract.expected_frame_count(10.0, 30), 300)
        self.assertEqual(timing_contract.expected_frame_count(1.0, 30), 30)
        self.assertEqual(timing_contract.expected_frame_count(30.5, 30), 915)
        self.assertEqual(timing_contract.expected_frame_count(0.5, 30), 15)

    def test_invalid_durations_rejected(self) -> None:
        for bad in (0, -1.5, math.nan, math.inf, -math.inf, "10"):
            with self.assertRaises(timing_contract.TimingValidationError):
                timing_contract.expected_frame_count(bad, 30)  # type: ignore[arg-type]

    def test_valid_segments_and_pause_extraction(self) -> None:
        segs = [
            {"text": "Hello", "start": 0.1, "end": 1.2},
            {"text": "world", "start": 1.8, "end": 3.0},
        ]
        res = timing_contract.validate_segments(segs, audio_duration_seconds=3.5, fps=30)
        self.assertEqual(res["total_frames"], 105)
        self.assertEqual(res["segment_count"], 2)
        self.assertEqual(len(res["pauses"]), 2)
        self.assertAlmostEqual(res["pauses"][1]["duration"], 0.6, places=3)

    def test_negative_segment_cases(self) -> None:
        # Overflow beyond audio
        with self.assertRaises(timing_contract.TimingValidationError):
            timing_contract.validate_segments(
                [{"text": "too long", "start": 0.0, "end": 4.2}],
                audio_duration_seconds=3.0,
            )
        # Overlap / reversed order
        with self.assertRaises(timing_contract.TimingValidationError):
            timing_contract.validate_segments(
                [
                    {"text": "a", "start": 0.0, "end": 1.5},
                    {"text": "b", "start": 1.2, "end": 2.0},
                ],
                audio_duration_seconds=3.0,
            )
        # Negative start
        with self.assertRaises(timing_contract.TimingValidationError):
            timing_contract.validate_segments(
                [{"text": "neg", "start": -0.2, "end": 1.0}],
                audio_duration_seconds=3.0,
            )
        # Zero duration segment
        with self.assertRaises(timing_contract.TimingValidationError):
            timing_contract.validate_segments(
                [{"text": "zero", "start": 1.0, "end": 1.0}],
                audio_duration_seconds=3.0,
            )


if __name__ == "__main__":
    unittest.main()
