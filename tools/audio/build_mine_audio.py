"""Assemble SAPI5 beat narration WAVs into exact 20s 48kHz stereo track + SFX/Music mix.

Provenance: NEW IMPLEMENTATION (SHORT-03A, using local Windows SAPI5 voice + template_audio + mix.py).
"""

from __future__ import annotations

import json
import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

from mix import DEFAULT_SAMPLE_RATE, mix_linear_gated_rms, read_wav_float, write_wav_pcm16
from template_audio import generate_template_stems

TARGET_FRAMES = 600
FPS = 30.0
TARGET_DURATION = TARGET_FRAMES / FPS
SR = DEFAULT_SAMPLE_RATE


def _resample_to_48k_stereo(src_wav: Path, dst_wav: Path) -> np.ndarray:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(src_wav),
            "-ar",
            str(SR),
            "-ac",
            "2",
            "-c:a",
            "pcm_s16le",
            str(dst_wav),
        ],
        check=True,
    )
    arr, sr = read_wav_float(dst_wav)
    if sr != SR:
        raise RuntimeError(f"Expected {SR}Hz, got {sr}Hz in {dst_wav}")
    return arr


def _trim_silence(arr: np.ndarray, threshold: float = 0.008, pad_ms: float = 25.0) -> tuple[np.ndarray, float, float]:
    mono = np.max(np.abs(arr), axis=1)
    idx = np.where(mono > threshold)[0]
    pad = int(round((pad_ms / 1000.0) * SR))
    if len(idx) == 0:
        return arr, 0.0, len(arr) / SR
    s0 = max(0, int(idx[0]) - pad)
    s1 = min(len(arr), int(idx[-1]) + 1 + pad)
    sliced = np.array(arr[s0:s1], copy=True)
    fade = min(len(sliced) // 4, int(0.012 * SR))
    if fade > 1:
        ramp = np.linspace(0.0, 1.0, fade)[:, None]
        sliced[:fade] *= ramp
        sliced[-fade:] *= ramp[::-1]
    return sliced, s0 / SR, s1 / SR


def main() -> int:
    work_dir = Path("workspace/cache/mine_audio")
    beats_path = work_dir / "beats_raw.json"
    if not beats_path.exists():
        raise FileNotFoundError(f"Missing {beats_path}; run tools/audio/generate_mine_narration.ps1 first.")

    raw = json.loads(beats_path.read_text(encoding="utf-8-sig"))
    trimmed_beats = []
    total_active_sec = 0.0
    for b in raw["beats"]:
        wav48 = work_dir / f"beat_{b['index']}_{b['id']}_48k.wav"
        arr = _resample_to_48k_stereo(Path(b["wav"]), wav48)
        sliced, trim_start_s, trim_end_s = _trim_silence(arr)
        dur_s = len(sliced) / SR
        total_active_sec += dur_s
        trimmed_beats.append((b, sliced, dur_s, trim_start_s, trim_end_s))

    lead_in_s = 0.14
    outro_tail_s = 0.28
    avail_gaps = max(0.25, TARGET_DURATION - total_active_sec - lead_in_s - outro_tail_s)
    gap_s = avail_gaps / max(1, len(trimmed_beats) - 1)

    total_samples = int(round(TARGET_DURATION * SR))
    narration = np.zeros((total_samples, 2), dtype=np.float64)
    cursor_s = lead_in_s
    timeline = []
    all_words = []

    for idx, (b, sliced, dur_s, trim_start_s, trim_end_s) in enumerate(trimmed_beats):
        start_s = cursor_s
        end_s = start_s + dur_s
        s_idx = int(round(start_s * SR))
        e_idx = min(total_samples, s_idx + len(sliced))
        if e_idx > s_idx:
            narration[s_idx:e_idx] += sliced[: e_idx - s_idx]

        # Shift raw SAPI word timestamps relative to trimmed start
        raw_dur_approx = max(dur_s, trim_end_s - trim_start_s)
        beat_words = []
        for w in b.get("words", []):
            rel_s = max(0.0, (float(w["rawMs"]) / 1000.0) - trim_start_s)
            rel_s = min(dur_s, rel_s)
            ws = start_s + rel_s
            beat_words.append(
                {
                    "word": w["word"],
                    "beat": b["id"],
                    "startSec": round(ws, 4),
                    "frame": min(TARGET_FRAMES - 1, max(0, int(round(ws * FPS)))),
                }
            )
            all_words.append(beat_words[-1])

        a_frame = 0 if idx == 0 else int(round((start_s - gap_s * 0.45) * FPS))
        timeline.append(
            {
                "index": b["index"],
                "id": b["id"],
                "text": b["text"],
                "speechStartSec": round(start_s, 4),
                "speechEndSec": round(end_s, 4),
                "a": a_frame,
                "b": TARGET_FRAMES - 1,  # filled right below
                "words": beat_words,
            }
        )
        cursor_s = end_s + gap_s

    for i in range(len(timeline) - 1):
        timeline[i]["b"] = timeline[i + 1]["a"] - 1

    # Normalize peak conservatively to -1.5 dBFS before mixing
    peak = float(np.max(np.abs(narration)))
    if peak > 0:
        narration *= 0.84 / peak

    narration_wav = work_dir / "narration_48k.wav"
    write_wav_pcm16(narration_wav, narration, SR)

    music_wav = work_dir / "mine_music_48k.wav"
    sfx_wav = work_dir / "mine_sfx_48k.wav"
    generate_template_stems("mine-salting-20s", TARGET_FRAMES, music_out=music_wav, sfx_out=sfx_wav)

    mus, _ = read_wav_float(music_wav)
    sx, _ = read_wav_float(sfx_wav)
    mixed, metrics = mix_linear_gated_rms(narration, mus, sx, sample_rate=SR)
    mixed_wav = work_dir / "mine_mixed_48k.wav"
    write_wav_pcm16(mixed_wav, mixed, SR)

    out_meta = {
        "title": "How Mine Salting Worked",
        "fps": FPS,
        "frames": TARGET_FRAMES,
        "durationSeconds": TARGET_DURATION,
        "provenance": raw["provenance"],
        "voice": raw["voice"],
        "timeline": timeline,
        "words": all_words,
        "mixMetrics": metrics,
        "files": {
            "narrationWav": str(narration_wav),
            "musicWav": str(music_wav),
            "sfxWav": str(sfx_wav),
            "mixedWav": str(mixed_wav),
        },
    }
    (work_dir / "mine_audio_manifest.json").write_text(json.dumps(out_meta, indent=2), encoding="utf-8")
    print(json.dumps({"durationSeconds": TARGET_DURATION, "timeline": [{k: t[k] for k in ("id", "a", "b", "speechStartSec", "speechEndSec")} for t in timeline], "mixMetrics": metrics}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
