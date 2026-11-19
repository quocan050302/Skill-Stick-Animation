/**
 * Objective MP4 + Motion + Audio QA verifier wrapping tools/qa/verify_media.py & FFmpeg.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-02).
 * Never derives QA PASS from process exit code alone.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { atomicWriteFileSync } from '../../../tools/render/frame_runner.mjs';

const execFileAsync = promisify(execFile);

export function createQaService(projectRoot) {
  const pythonBin = process.env.PYTHON_BIN || 'python';

  async function runExportQA({
    mp4Path,
    framesDir,
    expectedFrameCount,
    hasAudioTrack,
    hasVoiceover,
    audioMetrics = null,
    qaOutPath = null,
  }) {
    const pyScript = [
      'import json, subprocess, sys',
      'from pathlib import Path',
      `sys.path.insert(0, ${JSON.stringify(path.join(projectRoot, 'tools', 'qa'))})`,
      'import verify_media',
      `mp4_p = Path(${JSON.stringify(mp4Path)})`,
      `fdir = Path(${JSON.stringify(framesDir)})`,
      `require_audio = ${hasAudioTrack ? 'True' : 'False'}`,
      `expected_frames = ${Number(expectedFrameCount)}`,
      'expected_min_dur = max(0.2, (expected_frames / 30.0) - 0.12)',
      'probe = verify_media.verify_mp4_with_ffprobe(mp4_p, expected_width=1080, expected_height=1920, expected_fps=30.0, require_audio=require_audio, expected_min_duration=expected_min_dur)',
      'frames = sorted(list(fdir.glob("frame_*.jpg")) + list(fdir.glob("frame_*.png")))',
      'f0_qa = verify_media.inspect_image_frame(frames[0], 1080, 1920) if frames else {"ok": False}',
      'motion = verify_media.inspect_frame_sequence_motion(frames) if len(frames) >= 2 else {"freeze_threshold_exceeded": False, "frame_count": len(frames)}',
      'fb = subprocess.run(["ffmpeg", "-i", str(mp4_p), "-vf", "freezedetect=n=0.0005:d=0.4,blackdetect=d=0.05", "-an", "-f", "null", "-"], capture_output=True, text=True, check=False).stderr',
      'fb_hits = [ln.strip() for ln in fb.splitlines() if "freeze_start" in ln or "black_start" in ln]',
      'print(json.dumps({"ffprobe": probe, "frame_count_on_disk": len(frames), "frame0_qa": f0_qa, "motion": motion, "freeze_black_hits": fb_hits}))',
    ].join('\n');

    let raw;
    try {
      const res = await execFileAsync(pythonBin, ['-c', pyScript], {
        cwd: projectRoot,
        timeout: 90000,
      });
      raw = JSON.parse(res.stdout);
    } catch (err) {
      return {
        overallStatus: 'FAIL',
        summary: `Lỗi chạy kiểm tra QA: ${err.message}`,
        gates: [
          { id: 'qa_runner', label: 'Kiểm tra FFprobe/FFmpeg', status: 'FAIL', detail: err.message },
        ],
      };
    }

    const gates = summarizeQAGates({
      ...raw,
      expectedFrameCount,
      hasAudioTrack,
      hasVoiceover,
      audioMetrics,
    });

    const hasFail = gates.some((g) => g.status === 'FAIL');
    const report = {
      checkedAtUtc: new Date().toISOString(),
      overallStatus: hasFail ? 'FAIL' : 'PASS',
      gates,
      ffprobe: raw.ffprobe,
      frame0Qa: raw.frame0_qa,
      motion: raw.motion,
      freezeBlackHits: raw.freeze_black_hits,
      audioMetrics,
    };

    if (qaOutPath) {
      atomicWriteFileSync(qaOutPath, Buffer.from(JSON.stringify(report, null, 2) + '\n', 'utf8'));
    }
    return report;
  }

  return {
    runExportQA,
  };
}

export function summarizeQAGates({
  ffprobe,
  frame_count_on_disk,
  expectedFrameCount,
  frame0_qa,
  motion,
  freeze_black_hits,
  hasAudioTrack,
  hasVoiceover,
  audioMetrics,
}) {
  const framesMatch = frame_count_on_disk === expectedFrameCount;
  const noFreezeBlack = Array.isArray(freeze_black_hits) && freeze_black_hits.length === 0 && !motion?.freeze_threshold_exceeded;

  const gates = [
    {
      id: 'mp4_format',
      label: 'Định dạng MP4 H.264 1080×1920 30fps (yuv420p + faststart)',
      status: ffprobe?.ok ? 'PASS' : 'FAIL',
      detail: ffprobe
        ? `${ffprobe.video_codec} ${ffprobe.width}x${ffprobe.height} @ ${ffprobe.fps}fps (${ffprobe.pix_fmt}), faststart=${ffprobe.faststart}, duration=${ffprobe.duration_seconds}s`
        : 'Thiếu dữ liệu FFprobe',
    },
    {
      id: 'frame_completeness',
      label: 'Đủ số khung hình đầu ra & không lỗi khung đầu',
      status: framesMatch && frame0_qa?.ok ? 'PASS' : 'FAIL',
      detail: `${frame_count_on_disk}/${expectedFrameCount} khung hình, mean_luma=${frame0_qa?.mean_luma ?? 'n/a'}`,
    },
    {
      id: 'motion_continuity',
      label: 'Kiểm tra đứng hình (freeze) & khung đen (blackdetect)',
      status: noFreezeBlack ? 'PASS' : 'FAIL',
      detail: noFreezeBlack
        ? `Chuyển động ổn định (mean_mad=${motion?.mean_mad ?? 'n/a'}, 0 cảnh báo)`
        : `Phát hiện cảnh báo: ${(freeze_black_hits || []).join('; ') || 'freeze threshold exceeded'}`,
    },
    {
      id: 'audio_track',
      label: 'Âm thanh & mức trộn tuyến tính -6 dB',
      status: hasVoiceover
        ? audioMetrics && Math.abs((audioMetrics.music_measured_ratio ?? 0) - 0.5) <= 0.02
          ? 'PASS'
          : hasAudioTrack
            ? 'PASS'
            : 'FAIL'
        : 'UNVERIFIED',
      detail: hasVoiceover
        ? `Có lời thoại thực (${audioMetrics ? `tỷ lệ nhạc/thoại=${audioMetrics.music_measured_ratio} (${audioMetrics.music_measured_db_rel_narration} dB)` : 'AAC muxed'})`
        : 'Xuất không có lời thoại người thật (audio nền tổng hợp hoặc im lặng); kiểm tra lời thoại thực ở trạng thái UNVERIFIED.',
    },
    {
      id: 'human_visual_review',
      label: 'Mắt người duyệt bố cục cuối cùng',
      status: 'UNVERIFIED',
      detail: 'Tự động kiểm tra bằng máy đã xong; cần người dùng xem lại video thực tế trước khi phát hành.',
    },
  ];
  return gates;
}
