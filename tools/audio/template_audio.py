"""Synthesized music + SFX stem generator for studio templates.

Provenance: NEW IMPLEMENTATION (authored for SHORT-02).
Label: TECHNICAL_SYNTHETIC_MUSIC_SFX (stems for mix.py or no-voiceover bed).
"""

from __future__ import annotations

import argparse
import json
import sys
import wave
from pathlib import Path

import numpy as np

SR = 48000
FPS = 30.0


def _place(buf: np.ndarray, sig: np.ndarray, t0: float, gain: float = 1.0) -> None:
    i = int(round(t0 * SR))
    if i < 0:
        sig = sig[-i:]
        i = 0
    j = min(len(buf), i + len(sig))
    if i < len(buf) and j > i:
        buf[i:j] += sig[: j - i] * gain


def _finalize_stereo(mono: np.ndarray, peak_cap: float = 0.90) -> np.ndarray:
    buf = np.array(mono, dtype=np.float64, copy=True)
    peak = float(np.max(np.abs(buf))) if len(buf) else 0.0
    if peak > peak_cap:
        buf *= peak_cap / peak
    fade = min(len(buf), int(0.04 * SR))
    if fade > 1:
        buf[-fade:] *= np.linspace(1.0, 0.0, fade)
    return np.column_stack([buf, buf])


def _write_wav(path: Path, stereo: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.round(np.clip(stereo, -1.0, 1.0) * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())


def _synth_zombie_stems(n_samples: int) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(2026)
    music = np.zeros(n_samples, dtype=np.float64)
    sfx = np.zeros(n_samples, dtype=np.float64)

    bpm = 120.0
    beat = 60.0 / bpm
    notes = [261.63, 329.63, 392.00, 329.63, 293.66, 349.23, 440.00, 349.23]
    for step in range(24):
        t0 = step * (beat / 2.0)
        if t0 >= 5.05:
            break
        f = notes[step % len(notes)]
        n = int(0.24 * SR)
        t = np.arange(n) / SR
        tone = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 10.0)
        _place(music, tone, t0, 0.22)
        if step % 2 == 0:
            bass = np.sin(2 * np.pi * (f / 2.0) * t) * np.exp(-t * 7.0)
            _place(music, bass, t0, 0.18)

    n_win = int(0.8 * SR)
    tw = np.arange(n_win) / SR
    chord = (
        np.sin(2 * np.pi * 523.25 * tw)
        + np.sin(2 * np.pi * 659.25 * tw)
        + np.sin(2 * np.pi * 783.99 * tw)
    ) * np.minimum(1.0, tw / 0.03) * np.exp(-tw * 2.2)
    _place(music, chord, 276 / FPS, 0.14)

    for dt, freq in [(0.13, 1046.5), (0.34, 880.0)]:
        n = int(0.35 * SR)
        t = np.arange(n) / SR
        chime = (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t)) * np.exp(-t * 7.5)
        _place(sfx, chime, dt, 0.38)

    n_sad = int(0.95 * SR)
    ts = np.arange(n_sad) / SR
    f_drop = 310.0 * np.exp(-ts * 0.85)
    sad = np.sin(2 * np.pi * np.cumsum(f_drop) / SR) * np.exp(-ts * 2.4)
    _place(sfx, sad, 126 / FPS, 0.32)

    n_wh = int(0.35 * SR)
    tw2 = np.arange(n_wh) / SR
    whoosh = rng.standard_normal(n_wh) * (np.sin(np.pi * tw2 / 0.35) ** 2)
    X = np.fft.rfft(whoosh)
    freqs = np.fft.rfftfreq(n_wh, 1.0 / SR)
    X *= 1.0 / (1.0 + (freqs / 1100.0) ** 4)
    _place(sfx, np.fft.irfft(X, n_wh), 155 / FPS, 0.28)

    for k, dt in enumerate([0.0, 0.12, 0.24, 0.38, 0.55]):
        n_cl = int(0.22 * SR)
        tc = np.arange(n_cl) / SR
        f0 = 150.0 + k * 65.0
        clatter = (
            np.sin(2 * np.pi * f0 * tc * (1 + 0.4 * np.exp(-tc * 30))) * np.exp(-tc * 16)
            + rng.standard_normal(n_cl) * np.exp(-tc * 24) * 0.25
        )
        _place(sfx, clatter, 235 / FPS + dt, 0.42 * (0.85**k))

    n_bk = int(0.28 * SR)
    tb = np.arange(n_bk) / SR
    f_bk = 220.0 + 280.0 * np.sin(np.pi * np.minimum(1.0, tb / 0.14))
    bonk = np.sin(2 * np.pi * np.cumsum(f_bk) / SR) * np.exp(-tb * 11.0)
    _place(sfx, bonk, 268 / FPS, 0.45)

    for idx, freq in enumerate([1046.5, 1318.5, 1568.0]):
        n = int(0.32 * SR)
        t = np.arange(n) / SR
        _place(sfx, np.sin(2 * np.pi * freq * t) * np.exp(-t * 8.0), 278 / FPS + idx * 0.08, 0.28)

    return music, sfx


def _synth_plaza_stems(n_samples: int) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(2027)
    music = np.zeros(n_samples, dtype=np.float64)
    sfx = np.zeros(n_samples, dtype=np.float64)

    # Upbeat marimba-like plaza motif (F major / D minor bright promenade)
    dur_s = n_samples / SR
    step_dt = 0.22
    melody = [349.23, 440.00, 523.25, 440.00, 392.00, 440.00, 587.33, 523.25]
    bass_notes = [174.61, 174.61, 196.00, 146.83]
    total_steps = int(dur_s / step_dt)
    for step in range(total_steps):
        t0 = step * step_dt
        f = melody[step % len(melody)]
        n = int(0.20 * SR)
        t = np.arange(n) / SR
        marimba = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 11.5)
        _place(music, marimba, t0, 0.18)
        if step % 2 == 0:
            bf = bass_notes[(step // 2) % len(bass_notes)]
            nb = int(0.34 * SR)
            tb = np.arange(nb) / SR
            bass = np.sin(2 * np.pi * bf * tb) * np.minimum(1.0, tb / 0.015) * np.exp(-tb * 5.2)
            _place(music, bass, t0, 0.16)

    # Shot 1 (arrive f=6): morning bicycle bell
    for dt in (6 / FPS, 11 / FPS):
        n = int(0.32 * SR)
        t = np.arange(n) / SR
        bell = (np.sin(2 * np.pi * 1567.98 * t) + 0.4 * np.sin(2 * np.pi * 3135.96 * t)) * np.exp(-t * 9.0)
        _place(sfx, bell, dt, 0.30)

    # Shot 2 (inspect f=80): scanner confirm chirp
    for idx, freq in enumerate([880.0, 1174.66]):
        n = int(0.14 * SR)
        t = np.arange(n) / SR
        _place(sfx, np.sin(2 * np.pi * freq * t) * np.exp(-t * 14.0), 80 / FPS + idx * 0.11, 0.28)

    # Shot 3 (hurdle f=152): sprint whoosh & puddle splash
    n_wh = int(0.42 * SR)
    tw = np.arange(n_wh) / SR
    whoosh = rng.standard_normal(n_wh) * (np.sin(np.pi * tw / 0.42) ** 2)
    X = np.fft.rfft(whoosh)
    freqs = np.fft.rfftfreq(n_wh, 1.0 / SR)
    X *= 1.0 / (1.0 + (freqs / 1450.0) ** 3)
    _place(sfx, np.fft.irfft(X, n_wh), 152 / FPS, 0.26)

    # Shot 4 (deliver f=232): warm café doorbell + completion sparkle
    for idx, freq in enumerate([783.99, 1046.50, 1318.51]):
        n = int(0.38 * SR)
        t = np.arange(n) / SR
        _place(sfx, np.sin(2 * np.pi * freq * t) * np.exp(-t * 7.5), 232 / FPS + idx * 0.10, 0.26)

    return music, sfx


def _synth_generic_stems(n_samples: int) -> tuple[np.ndarray, np.ndarray]:
    music = np.zeros(n_samples, dtype=np.float64)
    sfx = np.zeros(n_samples, dtype=np.float64)
    dur_s = n_samples / SR
    step_dt = 0.5
    pulse_freqs = [110.0, 110.0, 130.81, 98.0]
    for step in range(int(dur_s / step_dt)):
        t0 = step * step_dt
        f = pulse_freqs[step % len(pulse_freqs)]
        n = int(0.35 * SR)
        t = np.arange(n) / SR
        pad = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * np.minimum(1.0, t / 0.02) * np.exp(-t * 4.5)
        _place(music, pad, t0, 0.18)
    for dt, f in [(0.25, 440.0), (max(0.5, dur_s - 0.8), 659.25)]:
        n = int(0.25 * SR)
        t = np.arange(n) / SR
        _place(sfx, np.sin(2 * np.pi * f * t) * np.exp(-t * 9.0), dt, 0.20)
    return music, sfx


def generate_template_stems(
    template_id: str,
    frames: int,
    music_out: Path | None = None,
    sfx_out: Path | None = None,
    combined_out: Path | None = None,
) -> dict:
    n_samples = max(SR // 2, int(round((frames / FPS) * SR)))
    if template_id == "zombie-store-10s":
        music, sfx = _synth_zombie_stems(n_samples)
    elif template_id == "plaza-courier-10s":
        music, sfx = _synth_plaza_stems(n_samples)
    else:
        music, sfx = _synth_generic_stems(n_samples)

    if music_out is not None:
        _write_wav(music_out, _finalize_stereo(music))
    if sfx_out is not None:
        _write_wav(sfx_out, _finalize_stereo(sfx))
    combined = music + sfx
    if combined_out is not None:
        _write_wav(combined_out, _finalize_stereo(combined))

    return {
        "template_id": template_id,
        "frames": frames,
        "duration_seconds": round(n_samples / SR, 4),
        "sample_rate": SR,
        "channels": 2,
        "music_out": str(music_out) if music_out else None,
        "sfx_out": str(sfx_out) if sfx_out else None,
        "combined_out": str(combined_out) if combined_out else None,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Synthesize template music & SFX stems")
    ap.add_argument("--template", required=True)
    ap.add_argument("--frames", type=int, default=300)
    ap.add_argument("--music-out", default=None)
    ap.add_argument("--sfx-out", default=None)
    ap.add_argument("--combined-out", default=None)
    args = ap.parse_args()

    res = generate_template_stems(
        template_id=args.template,
        frames=max(1, args.frames),
        music_out=Path(args.music_out) if args.music_out else None,
        sfx_out=Path(args.sfx_out) if args.sfx_out else None,
        combined_out=Path(args.combined_out) if args.combined_out else None,
    )
    print(json.dumps(res, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
