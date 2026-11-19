"""Audit original example/soldier/audio.py vs NEW SKILL-spec tools/audio/mix.py
and optionally export a clean music+SFX preview track (without fabricating human narration).

Provenance: NEW IMPLEMENTATION (non-mutating audit harness for SHORT-01 Phase 5).
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "audio"))
import mix as skill_mix  # noqa: E402


def run_soldier_audio_comparison(preview_music_sfx_wav: Path | None = None, preview_seconds: float = 6.0) -> dict:
    orig_audio_py = ROOT / "vendor" / "cartoon-short-kit" / "example" / "soldier" / "audio.py"
    if not orig_audio_py.exists():
        raise FileNotFoundError(f"Original audio.py not found at {orig_audio_py}")

    sr = 48000
    dur = 592 / 30.0
    vo_proxy, _, _ = skill_mix.generate_synthetic_technical_fixture(duration_seconds=dur, sample_rate=sr)

    with tempfile.TemporaryDirectory(dir=str(ROOT / "workspace" / "cache")) as td:
        tmp = Path(td)
        # Create technical synthetic voice.mp3 strictly as a non-speech signal proxy
        vo_wav = skill_mix.write_wav_pcm16(tmp / "voice_proxy.wav", vo_proxy, sr)
        vo_mp3 = tmp / "voice.mp3"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(vo_wav), "-c:a", "libmp3lame", "-b:a", "192k", str(vo_mp3)],
            check=True,
        )

        # Execute unmodified original audio.py inside isolated temp cwd (writes mix_raw.wav)
        proc = subprocess.run(
            [sys.executable, str(orig_audio_py)],
            cwd=str(tmp),
            capture_output=True,
            text=True,
            check=True,
        )
        orig_mix_samples, orig_sr = skill_mix.read_wav_float(tmp / "mix_raw.wav")

        # Also extract the exact original music & sfx numpy arrays without modifying audio.py
        # by reading audio.py source up to the voice-loading section in an isolated namespace
        src_text = orig_audio_py.read_text(encoding="utf-8")
        marker = "voice = load_voice()"
        assert marker in src_text
        stem_code = src_text.split(marker)[0]
        ns: dict = {}
        exec(compile(stem_code, str(orig_audio_py), "exec"), ns)
        soldier_music = np.asarray(ns["music"], dtype=np.float64)[:, None]
        soldier_sfx = np.asarray(ns["sfx"], dtype=np.float64)[:, None]

        # Config B: Feed exact original Soldier music + sfx stems + voice proxy into NEW SKILL-spec mix.py
        skill_mixed, skill_metrics = skill_mix.mix_linear_gated_rms(
            vo_proxy, soldier_music, soldier_sfx, sample_rate=sr
        )

        # Export preview music+SFX only WAV (strictly NO fake voiceover) if requested
        preview_info = None
        if preview_music_sfx_wav is not None:
            n_prev = int(round(preview_seconds * sr))
            bed = (soldier_music[:n_prev, 0] * 0.75 + soldier_sfx[:n_prev, 0] * 0.45)
            pk = float(np.max(np.abs(bed)))
            if pk > 0.9:
                bed = bed * (0.9 / pk)
            fade = int(0.05 * sr)
            bed[-fade:] *= np.linspace(1.0, 0.0, fade)
            stereo = np.column_stack([bed, bed])
            skill_mix.write_wav_pcm16(preview_music_sfx_wav, stereo, sr)
            preview_info = {
                "path": str(preview_music_sfx_wav),
                "label": "ORIGINAL_SOLDIER_MUSIC_SFX_STEMS_NO_VOICEOVER",
                "duration_seconds": round(n_prev / sr, 4),
                "final_peak": round(float(np.max(np.abs(bed))), 6),
            }

        orig_rms = skill_mix.compute_gated_rms(orig_mix_samples, sample_rate=orig_sr)
        return {
            "fixture_note": "TECHNICAL_SYNTHETIC_VOICE_PROXY_ONLY (no human voice.mp3 supplied)",
            "config_a_original_audio_py": {
                "provenance": "COPIED_ORIGINAL_UNMODIFIED_RUNTIME",
                "stdout": proc.stdout.strip(),
                "channels": int(orig_mix_samples.shape[1]),
                "sample_rate": orig_sr,
                "duration_seconds": round(orig_mix_samples.shape[0] / orig_sr, 4),
                "dynamic_ducking_present": True,
                "ducking_formula": "duck = 1 - 0.45 * clip(ve / (ve.max() * 0.25), 0, 1)",
                "saturation_present": True,
                "saturation_formula": "tanh(mix * 0.95) / tanh(0.95)",
                "final_peak": round(float(np.max(np.abs(orig_mix_samples))), 6),
                "gated_rms": round(orig_rms["gated_rms"], 6),
                "all_samples_finite": bool(np.all(np.isfinite(orig_mix_samples))),
                "divergence_vs_skill_md": (
                    "Original audio.py uses envelope-follower dynamic ducking + tanh saturation + "
                    "fixed scalar multipliers (1.4 music, 0.5 sfx) instead of writing stems for mix.py "
                    "linear -6.02 dB gated-RMS locking."
                ),
            },
            "config_b_new_skill_spec_mix_py": skill_metrics,
            "preview_music_sfx_export": preview_info,
        }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview-out", default=None)
    ap.add_argument("--preview-seconds", type=float, default=6.0)
    ap.add_argument("--report", default=None)
    args = ap.parse_args()
    out = run_soldier_audio_comparison(
        Path(args.preview_out) if args.preview_out else None,
        preview_seconds=args.preview_seconds,
    )
    payload = json.dumps(out, indent=2) + "\n"
    if args.report:
        Path(args.report).write_text(payload, encoding="utf-8")
    print(payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
