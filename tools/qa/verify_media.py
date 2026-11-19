"""Real image decoder QA and FFprobe/FFmpeg MP4 verification module.

Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01).
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image


class MediaVerificationError(ValueError):
    """Raised when an image or video artifact fails objective QA checks."""


def inspect_image_frame(
    image_path: Path | str,
    expected_width: int = 1080,
    expected_height: int = 1920,
    min_mean_luma: float = 5.0,
    min_std_luma: float = 3.0,
) -> dict[str, Any]:
    """Decode image with Pillow, verify dimensions, and reject black/flat frames."""
    p = Path(image_path)
    if not p.exists():
        raise FileNotFoundError(f"Frame not found: {p}")

    try:
        with Image.open(p) as im:
            im.load()
            width, height = im.size
            fmt = im.format
            mode = im.mode
            rgb = np.asarray(im.convert("RGB"), dtype=np.float32)
    except Exception as exc:
        raise MediaVerificationError(f"Corrupt or unreadable image {p}: {exc}") from exc

    luma = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    mean_luma = float(np.mean(luma))
    std_luma = float(np.std(luma))
    is_black_or_flat = mean_luma < min_mean_luma or std_luma < min_std_luma
    dims_ok = (width == expected_width) and (height == expected_height)

    report = {
        "path": str(p),
        "format": fmt,
        "mode": mode,
        "width": width,
        "height": height,
        "bytes": p.stat().st_size,
        "mean_luma": round(mean_luma, 3),
        "std_luma": round(std_luma, 3),
        "dims_ok": dims_ok,
        "is_black_or_flat": is_black_or_flat,
        "ok": dims_ok and not is_black_or_flat,
    }
    return report


def inspect_frame_sequence_motion(
    frame_paths: list[Path | str],
    freeze_mad_threshold: float = 0.25,
    max_consecutive_frozen_frames: int = 12,
) -> dict[str, Any]:
    """Measure inter-frame mean absolute difference (MAD) and detect frozen stretches."""
    if len(frame_paths) < 2:
        raise MediaVerificationError("Need at least 2 frames to inspect sequence motion")

    prev = None
    diffs: list[float] = []
    max_frozen_run = 0
    cur_frozen_run = 0

    for fp in frame_paths:
        with Image.open(fp) as im:
            arr = np.asarray(im.convert("RGB").resize((270, 480)), dtype=np.float32)
        if prev is not None:
            mad = float(np.mean(np.abs(arr - prev)))
            diffs.append(round(mad, 4))
            if mad < freeze_mad_threshold:
                cur_frozen_run += 1
                max_frozen_run = max(max_frozen_run, cur_frozen_run)
            else:
                cur_frozen_run = 0
        prev = arr

    return {
        "frame_count": len(frame_paths),
        "pair_count": len(diffs),
        "min_mad": min(diffs),
        "mean_mad": round(sum(diffs) / len(diffs), 4),
        "max_mad": max(diffs),
        "max_consecutive_frozen_pairs": max_frozen_run,
        "freeze_threshold_exceeded": max_frozen_run >= max_consecutive_frozen_frames,
    }


def _check_moov_before_mdat(mp4_path: Path) -> bool:
    """Inspect top-level ISO BMFF atoms to verify faststart (moov precedes mdat)."""
    moov_pos = None
    mdat_pos = None
    size = mp4_path.stat().st_size
    with mp4_path.open("rb") as f:
        pos = 0
        while pos + 8 <= size:
            f.seek(pos)
            header = f.read(8)
            if len(header) < 8:
                break
            box_size = int.from_bytes(header[:4], "big")
            box_type = header[4:8]
            if box_type == b"moov" and moov_pos is None:
                moov_pos = pos
            elif box_type == b"mdat" and mdat_pos is None:
                mdat_pos = pos
            if box_size == 1:
                ext = f.read(8)
                if len(ext) < 8:
                    break
                box_size = int.from_bytes(ext, "big")
            elif box_size == 0:
                break
            if box_size < 8:
                break
            pos += box_size
    return moov_pos is not None and mdat_pos is not None and moov_pos < mdat_pos


def verify_mp4_with_ffprobe(
    mp4_path: Path | str,
    expected_width: int = 1080,
    expected_height: int = 1920,
    expected_fps: float = 30.0,
    require_audio: bool = False,
    expected_min_duration: float | None = None,
) -> dict[str, Any]:
    """Run real FFprobe + FFmpeg null decode verification on an MP4 file."""
    p = Path(mp4_path)
    if not p.exists():
        raise FileNotFoundError(f"MP4 file not found: {p}")

    probe = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(p),
        ],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if probe.returncode != 0:
        raise MediaVerificationError(f"ffprobe failed (exit {probe.returncode}): {probe.stderr.strip()}")

    data = json.loads(probe.stdout)
    streams = data.get("streams", [])
    vstreams = [s for s in streams if s.get("codec_type") == "video"]
    astreams = [s for s in streams if s.get("codec_type") == "audio"]
    if not vstreams:
        raise MediaVerificationError(f"No video stream found in {p}")

    v = vstreams[0]
    width = int(v.get("width", 0))
    height = int(v.get("height", 0))
    codec_name = v.get("codec_name")
    pix_fmt = v.get("pix_fmt")
    r_fps_raw = v.get("avg_frame_rate") or v.get("r_frame_rate") or "0/1"
    num, den = (r_fps_raw.split("/") + ["1"])[:2]
    fps = float(num) / float(den) if float(den) != 0 else 0.0
    duration = float(data.get("format", {}).get("duration") or v.get("duration") or 0.0)

    decode = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(p), "-f", "null", "-"],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    decode_ok = decode.returncode == 0 and not decode.stderr.strip()

    audio_codec = astreams[0].get("codec_name") if astreams else None
    faststart_ok = _check_moov_before_mdat(p)

    checks = {
        "h264": codec_name == "h264",
        "dimensions_1080x1920": width == expected_width and height == expected_height,
        "fps_30": abs(fps - expected_fps) <= 0.1,
        "pix_fmt_yuv420p": pix_fmt == "yuv420p",
        "faststart_moov_first": faststart_ok,
        "audio_requirement_met": (audio_codec == "aac") if require_audio else (audio_codec in (None, "aac")),
        "duration_ok": duration > 0 and (expected_min_duration is None or duration >= expected_min_duration),
        "decode_clean": decode_ok,
    }

    return {
        "path": str(p),
        "bytes": p.stat().st_size,
        "video_codec": codec_name,
        "width": width,
        "height": height,
        "fps": round(fps, 3),
        "pix_fmt": pix_fmt,
        "audio_codec": audio_codec,
        "audio_present": bool(astreams),
        "duration_seconds": round(duration, 4),
        "faststart": faststart_ok,
        "decode_stderr": decode.stderr.strip(),
        "checks": checks,
        "ok": all(checks.values()),
    }
