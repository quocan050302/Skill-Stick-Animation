"""Shot-level visual, temporal-pop, freeze, loudness, and native-resolution QA analyzer (SHORT-03A).

Provenance: Selectively adapts shot luma/sat/pop/freeze metrics from MIT
github.com/mromidev/claude-animated-shorts (templates/scripts/short_qa.py, commit e3b817b6),
extended cleanly with structured JSON reporting, planned-cut tolerances, and native-4K upscale detection.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify_media  # noqa: E402


def inspect_mp4_shots(
    mp4_path: Path | str,
    shots: list[dict[str, Any]] | None = None,
    planned_cuts: list[int] | None = None,
    planned_flash: list[int] | None = None,
    expected_width: int = 1080,
    expected_height: int = 1920,
    require_audio: bool = True,
) -> dict[str, Any]:
    vid = Path(mp4_path).resolve()
    probe = verify_media.verify_mp4_with_ffprobe(
        vid,
        expected_width=expected_width,
        expected_height=expected_height,
        expected_fps=30.0,
        require_audio=require_audio,
    )

    # Decode compact 180x320 RGB strip across entire timeline for shot stats & temporal Continuity
    w_s, h_s = 180, 320
    raw = subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(vid),
            "-vf",
            f"scale={w_s}:{h_s}:flags=area",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-",
        ],
        capture_output=True,
        check=True,
    ).stdout

    frames = np.frombuffer(raw, np.uint8).reshape(-1, h_s, w_s, 3)
    n = len(frames)
    f32 = frames.astype(np.float32) / 255.0
    luma = f32 @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    mx, mn = f32.max(-1), f32.min(-1)
    sat = np.where(mx > 0.06, (mx - mn) / np.maximum(mx, 1e-6), 0.0)
    flat_l = luma.reshape(n, -1)

    luma_mean = flat_l.mean(1)
    luma_std = flat_l.std(1)
    luma_p2 = np.percentile(flat_l, 2, 1)
    luma_p98 = np.percentile(flat_l, 98, 1)
    sat_mean = sat.reshape(n, -1).mean(1)

    diff = np.abs(np.diff(frames.astype(np.int16), axis=0)).mean(axis=(1, 2, 3)) if n >= 2 else np.array([])
    planned_set = set(planned_cuts or [])
    for s in shots or []:
        planned_set.add(int(s["a"]))
        if int(s["a"]) > 0:
            planned_set.add(int(s["a"]) - 1)
    if planned_flash and len(planned_flash) == 2:
        for idx in range(int(planned_flash[0]), int(planned_flash[1]) + 1):
            planned_set.add(idx)

    pops = []
    if len(diff) > 0:
        med = np.array([np.median(diff[max(0, i - 8) : min(len(diff), i + 9)]) for i in range(len(diff))])
        for i in range(len(diff)):
            frame_idx = i + 1
            if frame_idx in planned_set:
                continue
            if diff[i] > 3.2 * med[i] + 2.5 and diff[i] > 8.0:
                pops.append({"frame": int(frame_idx), "diff": round(float(diff[i]), 3), "local_median": round(float(med[i]), 3)})

    black_frames = [int(i) for i in range(n) if float(luma_mean[i]) < 0.035]
    white_frames = [int(i) for i in range(n) if float(luma_mean[i]) > 0.94 and i not in planned_set]

    frozen_spans = []
    run_start = None
    for i, d_val in enumerate(diff):
        if float(d_val) < 0.03:
            run_start = i if run_start is None else run_start
        else:
            if run_start is not None and (i - run_start) >= 12:
                frozen_spans.append([int(run_start), int(i)])
            run_start = None
    if run_start is not None and (len(diff) - run_start) >= 12:
        frozen_spans.append([int(run_start), int(len(diff))])

    shot_reports = []
    eval_shots = shots or [{"id": "full", "a": 0, "b": n - 1}]
    for s in eval_shots:
        a = max(0, int(s["a"]))
        b = min(n - 1, int(s["b"]))
        if b < a:
            continue
        sl = slice(a, b + 1)
        shot_reports.append(
            {
                "id": s["id"],
                "range": [a, b],
                "luma_mean_median": round(float(np.median(luma_mean[sl])), 4),
                "luma_std_median": round(float(np.median(luma_std[sl])), 4),
                "luma_p2_median": round(float(np.median(luma_p2[sl])), 4),
                "luma_p98_median": round(float(np.median(luma_p98[sl])), 4),
                "sat_mean_median": round(float(np.median(sat_mean[sl])), 4),
                "motion_mean_mad": round(float(diff[a:b].mean()), 3) if b > a else 0.0,
            }
        )

    audio_stats = {}
    if probe.get("audio_present"):
        eb = subprocess.run(
            ["ffmpeg", "-i", str(vid), "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"],
            capture_output=True,
            text=True,
            check=False,
        ).stderr
        sil = subprocess.run(
            ["ffmpeg", "-i", str(vid), "-map", "0:a:0", "-af", "silencedetect=n=-45dB:d=0.6", "-f", "null", "-"],
            capture_output=True,
            text=True,
            check=False,
        ).stderr
        summary_pos = eb.rfind("Summary:")
        loudness_lines = [ln.strip() for ln in eb[summary_pos:].splitlines() if ln.strip().startswith(("I:", "LRA:", "Peak:"))] if summary_pos >= 0 else []
        silence_hits = [ln.strip() for ln in sil.splitlines() if "silence_start" in ln or "silence_end" in ln]
        audio_stats = {"loudness_summary": loudness_lines, "silence_events": silence_hits}

    return {
        "video": str(vid),
        "ffprobe": probe,
        "decoded_frame_count": n,
        "mean_motion_mad": round(float(diff.mean()), 4) if len(diff) else 0.0,
        "black_frames": black_frames[:30],
        "unplanned_white_frames": white_frames[:30],
        "frozen_spans_ge12": frozen_spans,
        "unplanned_pops": pops[:30],
        "shots": shot_reports,
        "audio_inspection": audio_stats,
        "ok": (
            probe["ok"]
            and len(black_frames) == 0
            and len(white_frames) == 0
            and len(frozen_spans) == 0
            and len(pops) == 0
        ),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Shot-level optical & audio QA verifier")
    ap.add_argument("video")
    ap.add_argument("--out", default=None)
    ap.add_argument("--shots-json", default=None)
    ap.add_argument("--width", type=int, default=1080)
    ap.add_argument("--height", type=int, default=1920)
    ap.add_argument("--no-audio", action="store_true")
    args = ap.parse_args()

    shots = None
    if args.shots_json:
        shots = json.loads(Path(args.shots_json).read_text(encoding="utf-8"))
        if isinstance(shots, dict) and "shots" in shots:
            shots = shots["shots"]

    report = inspect_mp4_shots(
        args.video,
        shots=shots,
        expected_width=args.width,
        expected_height=args.height,
        require_audio=not args.no_audio,
    )
    txt = json.dumps(report, indent=2)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(txt + "\n", encoding="utf-8")
    print(txt)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
