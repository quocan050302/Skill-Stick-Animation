"""Safe FFmpeg 9:16 H.264/yuv420p/faststart MP4 exporter (NEW IMPLEMENTATION).

Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01, extended for native 4K verification in SHORT-03A).
Uses argument arrays only (zero shell concatenation), atomic temp output + rename, verifies exact
input frame dimensions without spatial upscaling, and explicitly labels silent vs audio-muxed exports.
"""

from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any
from PIL import Image


class ExportError(RuntimeError):
    """Raised when FFmpeg export fails."""


def export_frames_to_mp4(
    frames_dir: Path | str,
    out_mp4: Path | str,
    fps: int = 30,
    frame_pattern: str = "frame_%06d.png",
    audio_wav: Path | str | None = None,
    timeout_seconds: int = 240,
    expected_width: int | None = None,
    expected_height: int | None = None,
    crf: int = 18,
) -> dict[str, Any]:
    """Encode image sequence cleanly at native dimensions into H.264 yuv420p 9:16 MP4."""
    fdir = Path(frames_dir).resolve()
    dest = Path(out_mp4).resolve()
    if not fdir.is_dir():
        raise ExportError(f"Frames directory does not exist: {fdir}")
    dest.parent.mkdir(parents=True, exist_ok=True)

    ext = Path(frame_pattern).suffix or ".png"
    sample_frames = sorted(fdir.glob(f"frame_*{ext}"))
    if not sample_frames:
        raise ExportError(f"No matching frames (*{ext}) found in {fdir}")

    # Verify native input dimensions on disk so FFmpeg never upscales or mixes resolutions
    with Image.open(sample_frames[0]) as im0:
        in_w, in_h = im0.size
    if expected_width is not None and in_w != expected_width:
        raise ExportError(f"Input frame width mismatch: expected {expected_width}, got {in_w} (upscaling is forbidden).")
    if expected_height is not None and in_h != expected_height:
        raise ExportError(f"Input frame height mismatch: expected {expected_height}, got {in_h} (upscaling is forbidden).")

    fd, tmp_name = tempfile.mkstemp(prefix=f".{dest.stem}.", suffix=".mp4", dir=str(dest.parent))
    os.close(fd)
    tmp_path = Path(tmp_name)

    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-framerate",
        str(int(fps)),
        "-i",
        str(fdir / frame_pattern),
    ]

    mode_label = "SILENT_TECHNICAL_MP4"
    if audio_wav is not None:
        audio_p = Path(audio_wav).resolve()
        if not audio_p.exists():
            raise ExportError(f"Audio file not found: {audio_p}")
        cmd.extend(["-i", str(audio_p), "-c:a", "aac", "-b:a", "192k", "-shortest"])
        mode_label = "AUDIO_MUXED_MP4"

    cmd.extend(
        [
            "-vf",
            "scale=in_range=full:out_range=tv,format=yuv420p",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            str(int(crf)),
            "-pix_fmt",
            "yuv420p",
            "-color_range",
            "tv",
            "-r",
            str(int(fps)),
            "-movflags",
            "+faststart",
            str(tmp_path),
        ]
    )

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        stdout, stderr = proc.communicate(timeout=timeout_seconds)
    except subprocess.TimeoutExpired as exc:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        raise ExportError(f"FFmpeg timed out after {timeout_seconds}s") from exc
    except KeyboardInterrupt:
        proc.terminate()
        proc.wait(timeout=5)
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        raise

    if proc.returncode != 0:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        raise ExportError(f"FFmpeg failed (exit {proc.returncode}): {stderr.strip()}")

    os.replace(tmp_path, dest)
    return {
        "out_mp4": str(dest),
        "input_width": in_w,
        "input_height": in_h,
        "bytes": dest.stat().st_size,
        "mode_label": mode_label,
        "ffmpeg_cmd": cmd,
        "stderr": stderr.strip(),
    }
