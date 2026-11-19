"""Timing and frame-count contract validators for SHORT-01.

Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01).
Note: Original cartoon-short-kit/tools/timing.py is currently INPUT_BLOCKED (missing ZIP).
Do NOT fabricate word-precise Whisper ASR timing when whisper/faster_whisper is absent;
mark real speech alignment UNVERIFIED unless verified ASR output is supplied.
"""

from __future__ import annotations

import math
from typing import Any

FPS_DEFAULT = 30


class TimingValidationError(ValueError):
    """Raised when audio duration or phrase/word timing violates contract."""


def expected_frame_count(duration_seconds: float, fps: int = FPS_DEFAULT) -> int:
    """Compute canonical frame count = round(duration_seconds * fps)."""
    if not isinstance(duration_seconds, (int, float)) or not math.isfinite(duration_seconds):
        raise TimingValidationError(f"Non-finite duration_seconds: {duration_seconds!r}")
    if duration_seconds <= 0:
        raise TimingValidationError(f"duration_seconds must be > 0; got {duration_seconds}")
    if not isinstance(fps, int) or fps <= 0:
        raise TimingValidationError(f"fps must be a positive integer; got {fps!r}")
    count = int(round(duration_seconds * fps))
    if count <= 0:
        raise TimingValidationError(
            f"Duration {duration_seconds}s at {fps}fps rounds to 0 frames."
        )
    return count


def validate_segments(
    segments: list[dict[str, Any]],
    audio_duration_seconds: float,
    fps: int = FPS_DEFAULT,
    tolerance_seconds: float = 0.005,
) -> dict[str, Any]:
    """Validate monotonic order, non-negative bounds, no overlap, and no audio overflow."""
    total_frames = expected_frame_count(audio_duration_seconds, fps=fps)
    if not isinstance(segments, list):
        raise TimingValidationError("segments must be a list")

    prev_end = 0.0
    pauses: list[dict[str, float]] = []
    normalized: list[dict[str, Any]] = []

    for idx, seg in enumerate(segments):
        if not isinstance(seg, dict):
            raise TimingValidationError(f"Segment {idx} must be a dict")
        start = seg.get("start")
        end = seg.get("end")
        text = str(seg.get("text", "")).strip()
        if not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
            raise TimingValidationError(f"Segment {idx} requires numeric start/end")
        if not (math.isfinite(start) and math.isfinite(end)):
            raise TimingValidationError(f"Segment {idx} has non-finite timestamps")
        if start < 0:
            raise TimingValidationError(f"Segment {idx} has negative start: {start}")
        if end <= start:
            raise TimingValidationError(f"Segment {idx} has non-positive duration: {start}..{end}")
        if start + tolerance_seconds < prev_end:
            raise TimingValidationError(
                f"Segment {idx} overlaps or reverses prior segment ({start} < {prev_end})"
            )
        if end > audio_duration_seconds + tolerance_seconds:
            raise TimingValidationError(
                f"Segment {idx} overflows audio duration ({end} > {audio_duration_seconds})"
            )

        gap = start - prev_end
        if gap > 0.02:
            pauses.append({"after_index": idx - 1, "start": round(prev_end, 4), "end": round(start, 4), "duration": round(gap, 4)})

        start_frame = int(round(start * fps))
        end_frame = min(total_frames, int(round(end * fps)))
        normalized.append(
            {
                "index": idx,
                "text": text,
                "start": float(start),
                "end": float(end),
                "start_frame": start_frame,
                "end_frame": max(start_frame + 1, end_frame),
            }
        )
        prev_end = float(end)

    return {
        "audio_duration_seconds": float(audio_duration_seconds),
        "fps": fps,
        "total_frames": total_frames,
        "segment_count": len(normalized),
        "pauses": pauses,
        "segments": normalized,
        "alignment_mode": "VALIDATED_INPUT_SEGMENTS",
    }
