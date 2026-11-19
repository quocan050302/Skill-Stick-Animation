"""Synthesized music + comedy SFX bed for the 10-second Convenience Store Zombie proof.

Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01 Phase 7).
Label: TECHNICAL_SYNTHETIC_MUSIC_SFX_NO_VOICEOVER (no fake speech/narration).
"""

from __future__ import annotations

import argparse
import json
import sys
import wave
from pathlib import Path
import numpy as np

SR = 48000
DUR = 300 / 30.0  # Exact 10.00 seconds
N = int(DUR * SR)


def place(buf: np.ndarray, sig: np.ndarray, t0: float, gain: float = 1.0) -> None:
    i = int(round(t0 * SR))
    j = min(len(buf), i + len(sig))
    if i < len(buf) and j > i:
        buf[i:j] += sig[: j - i] * gain


def synth_zombie_demo_audio(out_wav: Path) -> dict:
    rng = np.random.default_rng(2026)
    music = np.zeros(N, dtype=np.float64)
    sfx = np.zeros(N, dtype=np.float64)

    # Playful bouncy pizzicato convenience-store loop (0.0s .. 5.1s, stops on shock reveal!)
    bpm = 120.0
    beat = 60.0 / bpm
    notes = [261.63, 329.63, 392.00, 329.63, 293.66, 349.23, 440.00, 349.23]
    for step in range(20):
        t0 = step * (beat / 2.0)
        if t0 >= 5.05:
            break
        f = notes[step % len(notes)]
        n = int(0.24 * SR)
        t = np.arange(n) / SR
        tone = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 10.0)
        place(music, tone, t0, 0.22)
        if step % 2 == 0:
            bass = np.sin(2 * np.pi * (f / 2.0) * t) * np.exp(-t * 7.0)
            place(music, bass, t0, 0.18)

    # Celebratory bright chord at final payoff (f=276..299, t=9.2..10.0s)
    n_win = int(0.8 * SR)
    tw = np.arange(n_win) / SR
    chord = (
        np.sin(2 * np.pi * 523.25 * tw)
        + np.sin(2 * np.pi * 659.25 * tw)
        + np.sin(2 * np.pi * 783.99 * tw)
    ) * np.minimum(1.0, tw / 0.03) * np.exp(-tw * 2.2)
    place(music, chord, 276 / 30.0, 0.14)

    # 1. Convenience store entry door "ding-dong!" chime (f=4, t=0.13s)
    for dt, freq in [(0.13, 1046.5), (0.34, 880.0)]:
        n = int(0.35 * SR)
        t = np.arange(n) / SR
        chime = (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t)) * np.exp(-t * 7.5)
        place(sfx, chime, dt, 0.38)

    # 2. Comedic sad descending sting on empty shelf reveal (f=126, t=4.2s)
    n_sad = int(0.95 * SR)
    ts = np.arange(n_sad) / SR
    f_drop = 310.0 * np.exp(-ts * 0.85)
    sad = np.sin(2 * np.pi * np.cumsum(f_drop) / SR) * np.exp(-ts * 2.4)
    place(sfx, sad, 126 / 30.0, 0.32)

    # 3. Dramatic zoom whoosh on reaction cut (f=155, t=5.16s)
    n_wh = int(0.35 * SR)
    tw2 = np.arange(n_wh) / SR
    whoosh = rng.standard_normal(n_wh) * (np.sin(np.pi * tw2 / 0.35) ** 2)
    X = np.fft.rfft(whoosh)
    freqs = np.fft.rfftfreq(n_wh, 1.0 / SR)
    X *= 1.0 / (1.0 + (freqs / 1100.0) ** 4)
    place(sfx, np.fft.irfft(X, n_wh), 155 / 30.0, 0.28)

    # 4. Basket tower BUMP clatter + bouncing cans (f=235..262, t=7.83..8.73s)
    for k, dt in enumerate([0.0, 0.12, 0.24, 0.38, 0.55]):
        n_cl = int(0.22 * SR)
        tc = np.arange(n_cl) / SR
        f0 = 150.0 + k * 65.0
        clatter = (
            np.sin(2 * np.pi * f0 * tc * (1 + 0.4 * np.exp(-tc * 30))) * np.exp(-tc * 16)
            + rng.standard_normal(n_cl) * np.exp(-tc * 24) * 0.25
        )
        place(sfx, clatter, 235 / 30.0 + dt, 0.42 * (0.85 ** k))

    # 5. Comic BONK when MEGA CHIPS bag lands on Bloop's head (f=268, t=8.93s)
    n_bk = int(0.28 * SR)
    tb = np.arange(n_bk) / SR
    f_bk = 220.0 + 280.0 * np.sin(np.pi * np.minimum(1.0, tb / 0.14))
    bonk = np.sin(2 * np.pi * np.cumsum(f_bk) / SR) * np.exp(-tb * 11.0)
    place(sfx, bonk, 268 / 30.0, 0.45)

    # 6. Victory sparkle chime (f=278, t=9.27s)
    for idx, freq in enumerate([1046.5, 1318.5, 1568.0]):
        n = int(0.32 * SR)
        t = np.arange(n) / SR
        place(sfx, np.sin(2 * np.pi * freq * t) * np.exp(-t * 8.0), 278 / 30.0 + idx * 0.08, 0.28)

    mix_mono = music + sfx
    peak = float(np.max(np.abs(mix_mono)))
    if peak > 0.90:
        mix_mono = mix_mono * (0.90 / peak)
    fade = int(0.04 * SR)
    mix_mono[-fade:] *= np.linspace(1.0, 0.0, fade)

    stereo = np.column_stack([mix_mono, mix_mono])
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.round(np.clip(stereo, -1.0, 1.0) * 32767.0).astype("<i2")
    with wave.open(str(out_wav), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())

    return {
        "out_wav": str(out_wav),
        "label": "TECHNICAL_SYNTHETIC_MUSIC_SFX_NO_VOICEOVER",
        "duration_seconds": round(len(mix_mono) / SR, 4),
        "sample_rate": SR,
        "channels": 2,
        "final_peak": round(float(np.max(np.abs(mix_mono))), 6),
        "all_finite": bool(np.all(np.isfinite(mix_mono))),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    print(json.dumps(synth_zombie_demo_audio(Path(args.out)), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
