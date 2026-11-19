"""SKILL-specified linear relative-level audio mixer (NEW IMPLEMENTATION).

Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01).
Reason: The original cartoon-short-kit.zip does NOT include mix.py (noted in Section 3
& Section 10.2 of the SHORT-01 specification). This module is NOT copied from upstream.

Contract implemented:
- Computes gated RMS of narration (excluding silence frames below gate threshold).
- Scales music linearly to a constant gain so its gated/active RMS equals 50% of gated
  narration RMS (-6.0206 dB) with NO dynamic ducking.
- Scales SFX linearly with configurable target relative ratio and enforces peak cap.
- Validates finite samples (no NaN/Inf), channel consistency, exact duration matching,
  and peak safety (transparent soft/hard cap documented in output metrics).
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import wave
from pathlib import Path
from typing import Any

import numpy as np

DEFAULT_SAMPLE_RATE = 48000
TARGET_MUSIC_RMS_RATIO = 0.5  # -6.0205999 dB relative to gated narration RMS
DEFAULT_GATE_DBFS = -40.0
DEFAULT_PEAK_CAP = 0.96


class AudioContractError(ValueError):
    """Raised when audio inputs or signals violate safety/contract constraints."""


def _validate_samples(samples: np.ndarray, label: str) -> np.ndarray:
    arr = np.asarray(samples, dtype=np.float64)
    if arr.ndim == 1:
        arr = arr[:, None]
    elif arr.ndim != 2 or arr.shape[1] not in (1, 2):
        raise AudioContractError(f"{label}: expected 1D or 2D mono/stereo array, got shape {arr.shape}")
    if arr.shape[0] == 0:
        raise AudioContractError(f"{label}: empty audio buffer")
    if not np.all(np.isfinite(arr)):
        raise AudioContractError(f"{label}: contains NaN or Inf samples")
    return arr


def _to_stereo(arr: np.ndarray) -> np.ndarray:
    if arr.shape[1] == 2:
        return arr.copy()
    return np.repeat(arr, 2, axis=1)


def read_wav_float(path: Path | str) -> tuple[np.ndarray, int]:
    """Read 16-bit or 32-bit PCM WAV into float64 [-1, 1] with shape (N, C)."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"WAV file not found: {p}")
    with wave.open(str(p), "rb") as wf:
        channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        sample_rate = wf.getframerate()
        n_frames = wf.getnframes()
        if channels not in (1, 2):
            raise AudioContractError(f"Unsupported channel count {channels} in {p}")
        if n_frames <= 0:
            raise AudioContractError(f"Zero-frame WAV file: {p}")
        raw = wf.readframes(n_frames)

    if sampwidth == 2:
        data = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
    elif sampwidth == 4:
        data = np.frombuffer(raw, dtype="<i4").astype(np.float64) / 2147483648.0
    else:
        raise AudioContractError(f"Unsupported WAV sample width {sampwidth} bytes in {p}")

    data = data.reshape(-1, channels)
    return _validate_samples(data, str(p)), sample_rate


def write_wav_pcm16(path: Path | str, samples: np.ndarray, sample_rate: int = DEFAULT_SAMPLE_RATE) -> Path:
    """Write float64 [-1, 1] stereo/mono array to 16-bit PCM WAV."""
    arr = _validate_samples(samples, "write_wav_pcm16")
    clipped = np.clip(arr, -1.0, 1.0)
    pcm = np.round(clipped * 32767.0).astype("<i2")
    out_path = Path(path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out_path), "wb") as wf:
        wf.setnchannels(arr.shape[1])
        wf.setsampwidth(2)
        wf.setframerate(int(sample_rate))
        wf.writeframes(pcm.tobytes())
    return out_path


def compute_gated_rms(
    samples: np.ndarray,
    sample_rate: int = DEFAULT_SAMPLE_RATE,
    window_ms: float = 50.0,
    gate_dbfs: float = DEFAULT_GATE_DBFS,
) -> dict[str, float]:
    """Compute gated RMS over active windows exceeding gate_dbfs."""
    arr = _validate_samples(samples, "gated_rms")
    mono = np.mean(arr, axis=1)
    win = max(1, int(round(sample_rate * (window_ms / 1000.0))))
    n_blocks = len(mono) // win
    if n_blocks == 0:
        rms = float(np.sqrt(np.mean(mono ** 2)))
        return {
            "gated_rms": rms,
            "ungated_rms": rms,
            "active_window_ratio": 1.0 if rms > 0 else 0.0,
            "gate_dbfs": float(gate_dbfs),
        }

    trimmed = mono[: n_blocks * win].reshape(n_blocks, win)
    block_rms = np.sqrt(np.mean(trimmed ** 2, axis=1))
    gate_linear = 10.0 ** (gate_dbfs / 20.0)
    active = block_rms >= gate_linear

    ungated_rms = float(np.sqrt(np.mean(mono ** 2)))
    if not np.any(active):
        return {
            "gated_rms": 0.0,
            "ungated_rms": ungated_rms,
            "active_window_ratio": 0.0,
            "gate_dbfs": float(gate_dbfs),
        }

    gated_rms = float(np.sqrt(np.mean(block_rms[active] ** 2)))
    return {
        "gated_rms": gated_rms,
        "ungated_rms": ungated_rms,
        "active_window_ratio": float(np.mean(active)),
        "gate_dbfs": float(gate_dbfs),
    }


def _match_length(arr: np.ndarray, target_len: int) -> np.ndarray:
    cur = arr.shape[0]
    if cur == target_len:
        return arr
    if cur > target_len:
        return arr[:target_len]
    pad = np.zeros((target_len - cur, arr.shape[1]), dtype=np.float64)
    return np.vstack([arr, pad])


def mix_linear_gated_rms(
    narration: np.ndarray,
    music: np.ndarray | None = None,
    sfx: np.ndarray | None = None,
    sample_rate: int = DEFAULT_SAMPLE_RATE,
    music_rms_ratio: float = TARGET_MUSIC_RMS_RATIO,
    sfx_rms_ratio: float = TARGET_MUSIC_RMS_RATIO,
    sfx_peak_cap: float = 0.65,
    master_peak_cap: float = DEFAULT_PEAK_CAP,
    gate_dbfs: float = DEFAULT_GATE_DBFS,
) -> tuple[np.ndarray, dict[str, Any]]:
    """Mix narration + constant-gain music + bounded SFX without dynamic ducking."""
    vo = _to_stereo(_validate_samples(narration, "narration"))
    n_samples = vo.shape[0]

    vo_stats = compute_gated_rms(vo, sample_rate=sample_rate, gate_dbfs=gate_dbfs)
    if vo_stats["gated_rms"] <= 1e-6:
        raise AudioContractError(
            f"Narration has no active speech energy above {gate_dbfs} dBFS (gated_rms={vo_stats['gated_rms']})"
        )

    music_gain = 0.0
    music_scaled = np.zeros_like(vo)
    music_measured_rms = 0.0
    if music is not None:
        mus = _match_length(_to_stereo(_validate_samples(music, "music")), n_samples)
        mus_stats = compute_gated_rms(mus, sample_rate=sample_rate, gate_dbfs=gate_dbfs)
        base_rms = mus_stats["gated_rms"] if mus_stats["gated_rms"] > 1e-7 else mus_stats["ungated_rms"]
        if base_rms > 1e-7:
            target_mus_rms = vo_stats["gated_rms"] * float(music_rms_ratio)
            music_gain = target_mus_rms / base_rms
            music_scaled = mus * music_gain
            music_measured_rms = compute_gated_rms(
                music_scaled, sample_rate=sample_rate, gate_dbfs=gate_dbfs
            )["gated_rms"]

    sfx_gain = 0.0
    sfx_scaled = np.zeros_like(vo)
    sfx_peak_after = 0.0
    if sfx is not None:
        sx = _match_length(_to_stereo(_validate_samples(sfx, "sfx")), n_samples)
        sx_stats = compute_gated_rms(sx, sample_rate=sample_rate, gate_dbfs=gate_dbfs)
        sx_base_rms = sx_stats["gated_rms"] if sx_stats["gated_rms"] > 1e-7 else sx_stats["ungated_rms"]
        if sx_base_rms > 1e-7:
            sfx_gain = (vo_stats["gated_rms"] * float(sfx_rms_ratio)) / sx_base_rms
            sfx_scaled = sx * sfx_gain
            peak = float(np.max(np.abs(sfx_scaled)))
            if peak > sfx_peak_cap:
                cap_scale = sfx_peak_cap / peak
                sfx_scaled = sfx_scaled * cap_scale
                sfx_gain *= cap_scale
            sfx_peak_after = float(np.max(np.abs(sfx_scaled)))

    summed = vo + music_scaled + sfx_scaled
    pre_limit_peak = float(np.max(np.abs(summed)))
    master_gain = 1.0
    limiter_engaged = False
    if pre_limit_peak > master_peak_cap:
        # Uniform linear master gain reduction preserves exact music-to-narration ratio!
        master_gain = master_peak_cap / pre_limit_peak
        limiter_engaged = True
        mixed = summed * master_gain
    else:
        mixed = summed

    final_peak = float(np.max(np.abs(mixed)))
    final_vo_rms = vo_stats["gated_rms"] * master_gain
    final_mus_rms = music_measured_rms * master_gain
    actual_ratio = (final_mus_rms / final_vo_rms) if final_vo_rms > 0 else 0.0
    actual_db = (20.0 * math.log10(actual_ratio)) if actual_ratio > 0 else float("-inf")

    metrics = {
        "provenance": "NEW_IMPLEMENTATION_SKILL_SPEC_LINEAR_MIXER",
        "dynamic_ducking": False,
        "sample_rate": int(sample_rate),
        "channels": 2,
        "samples": int(n_samples),
        "duration_seconds": round(n_samples / float(sample_rate), 6),
        "narration_gated_rms": round(vo_stats["gated_rms"], 6),
        "narration_active_ratio": round(vo_stats["active_window_ratio"], 4),
        "music_linear_gain": round(music_gain, 6),
        "music_target_ratio": float(music_rms_ratio),
        "music_measured_ratio": round(actual_ratio, 6),
        "music_measured_db_rel_narration": round(actual_db, 4) if math.isfinite(actual_db) else None,
        "sfx_linear_gain": round(sfx_gain, 6),
        "sfx_peak_after_cap": round(sfx_peak_after, 6),
        "sfx_peak_cap": float(sfx_peak_cap),
        "pre_limit_peak": round(pre_limit_peak, 6),
        "master_linear_gain": round(master_gain, 6),
        "limiter_engaged": limiter_engaged,
        "final_peak": round(final_peak, 6),
        "master_peak_cap": float(master_peak_cap),
        "all_samples_finite": bool(np.all(np.isfinite(mixed))),
        "clipped_samples": int(np.sum(np.abs(mixed) > 1.0)),
    }
    return mixed, metrics


def generate_synthetic_technical_fixture(
    duration_seconds: float = 3.0,
    sample_rate: int = DEFAULT_SAMPLE_RATE,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Generate deterministic non-speech technical signals for automated mixer tests ONLY."""
    n = int(round(duration_seconds * sample_rate))
    t = np.arange(n, dtype=np.float64) / float(sample_rate)

    # Bursting voice-band proxy envelope (active ~65% of timeline, with clear silent pauses)
    envelope = np.where(((t % 1.0) >= 0.15) & ((t % 1.0) <= 0.80), 1.0, 0.0)
    narration = (0.30 * np.sin(2.0 * np.pi * 220.0 * t) + 0.12 * np.sin(2.0 * np.pi * 440.0 * t)) * envelope

    # Steady background pad proxy (intentionally louder prior to linear scaling)
    music = 0.45 * np.sin(2.0 * np.pi * 110.0 * t) + 0.25 * np.sin(2.0 * np.pi * 165.0 * t)

    # Short transient SFX impulse at t=1.2s
    sfx = np.zeros(n, dtype=np.float64)
    idx0 = int(1.2 * sample_rate)
    dur = int(0.15 * sample_rate)
    if idx0 + dur < n:
        tt = np.arange(dur, dtype=np.float64) / float(sample_rate)
        sfx[idx0 : idx0 + dur] = 0.8 * np.exp(-25.0 * tt) * np.sin(2.0 * np.pi * 880.0 * tt)

    return narration[:, None], music[:, None], sfx[:, None]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Linear gated-RMS audio mixer (SKILL spec, NEW CODE)")
    parser.add_argument("--narration", required=True, help="Narration WAV path")
    parser.add_argument("--music", default=None, help="Optional music WAV path")
    parser.add_argument("--sfx", default=None, help="Optional SFX WAV path")
    parser.add_argument("--out", required=True, help="Output mixed WAV path")
    parser.add_argument("--music-ratio", type=float, default=TARGET_MUSIC_RMS_RATIO)
    args = parser.parse_args(argv)

    vo, sr = read_wav_float(args.narration)
    mus = None
    if args.music:
        mus, mus_sr = read_wav_float(args.music)
        if mus_sr != sr:
            raise AudioContractError(f"Sample rate mismatch: narration={sr}, music={mus_sr}")
    sx = None
    if args.sfx:
        sx, sx_sr = read_wav_float(args.sfx)
        if sx_sr != sr:
            raise AudioContractError(f"Sample rate mismatch: narration={sr}, sfx={sx_sr}")

    mixed, metrics = mix_linear_gated_rms(vo, mus, sx, sample_rate=sr, music_rms_ratio=args.music_ratio)
    write_wav_pcm16(args.out, mixed, sample_rate=sr)
    print(json.dumps(metrics, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
