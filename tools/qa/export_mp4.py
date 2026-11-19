"""Safe FFmpeg 9:16 H.264/yuv420p/faststart MP4 exporter (NEW IMPLEMENTATION).

Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01).
Uses argument arrays only (zero shell concatenation), atomic temp output + rename,
and explicitly labels silent technical exports vs audio-muxed exports.
"""

from __future__ import annotations

import os
import signal
import subprocess
import tempfile
from pathlib import Path
from typing import Any


class ExportError(RuntimeError):
    """Raised when FFmpeg export fails."""


def export_frames_to_mp4(
    frames_dir: Path | str,
    out_mp4: Path | str,
    fps: int = 30,
    frame_pattern: str = "frame_%06d.png",
    audio_wav: Path | str | None = None,
    timeout_seconds: int = 120,
) -> dict[str, Any]:
    """Encode image sequence into H.264 yuv420p 9:16 MP4 with +faststart."""
    fdir = Path(frames_dir).resolve()
    dest = Path(out_mp4).resolve()
    if not fdir.is_dir():
        raise ExportError(f"Frames directory does not exist: {fdir}")
    dest.parent.mkdir(parents=True, exist_ok=True)

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
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
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
        "bytes": dest.stat().st_size,
        "mode_label": mode_label,
        "ffmpeg_cmd": cmd,
        "stderr": stderr.strip(),
    }
