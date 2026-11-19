/**
 * Objective MP4 + Native Resolution + Motion + Strict Audio QA verifier (SHORT-03A).
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-02, fixed & extended for SHORT-03A).
 * Never derives audio ratio PASS or native-4K PASS from stream existence alone.
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { atomicWriteFileSync } from '../../../tools/render/frame_runner.mjs';
import { resolveOutputPreset } from '../../shared/contract.mjs';

const execFileAsync = promisify(execFile);

export function createQaService(projectRoot) {
  const pythonBin = process.env.PYTHON_BIN || 'python';

  async function runExportQA({
    mp4Path,
    framesDir,
    expectedFrameCount,
    outputPreset = 'standard',
    webglProof = null,
    hasAudioTrack,
    hasVoiceover,
    audioMetrics = null,
    qaOutPath = null,
  }) {
    const preset = resolveOutputPreset(outputPreset);
    const pyScript = [
      'import json, subprocess, sys',
      'from pathlib import Path',
      `sys.path.insert(0, ${JSON.stringify(path.join(projectRoot, 'tools', 'qa'))})`,
      'import verify_media',
      `mp4_p = Path(${JSON.stringify(mp4Path)})`,
      `fdir = Path(${JSON.stringify(framesDir)})`,
      `require_audio = ${hasAudioTrack ? 'True' : 'False'}`,
      `expected_frames = ${Number(expectedFrameCount)}`,
      `expected_w = ${preset.width}`,
      `expected_h = ${preset.height}`,
      'expected_min_dur = max(0.2, (expected_frames / 30.0) - 0.12)',
      'probe = verify_media.verify_mp4_with_ffprobe(mp4_p, expected_width=expected_w, expected_height=expected_h, expected_fps=30.0, require_audio=require_audio, expected_min_duration=expected_min_dur)',
      'frames = sorted(list(fdir.glob("frame_*.jpg")) + list(fdir.glob("frame_*.png")))',
      'f0_qa = verify_media.inspect_image_frame(frames[0], expected_w, expected_h) if frames else {"ok": False}',
      'motion = verify_media.inspect_frame_sequence_motion(frames) if len(frames) >= 2 else {"freeze_threshold_exceeded": False, "frame_count": len(frames)}',
      'detail_4k = verify_media.check_native_4k_detail(frames[0]) if (frames and expected_w == 2160 and expected_h == 3840 and hasattr(verify_media, "check_native_4k_detail")) else None',
      'fb = subprocess.run(["ffmpeg", "-i", str(mp4_p), "-vf", "freezedetect=n=0.0005:d=0.4,blackdetect=d=0.05", "-an", "-f", "null", "-"], capture_output=True, text=True, check=False).stderr',
      'fb_hits = [ln.strip() for ln in fb.splitlines() if "freeze_start" in ln or "black_start" in ln]',
      'print(json.dumps({"ffprobe": probe, "frame_count_on_disk": len(frames), "frame0_qa": f0_qa, "motion": motion, "detail_4k": detail_4k, "freeze_black_hits": fb_hits}))',
    ].join('\n');

    let raw;
    try {
      const res = await execFileAsync(pythonBin, ['-c', pyScript], {
        cwd: projectRoot,
        timeout: preset.id === 'native_4k' ? 240_000 : 120_000,
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
      outputPreset: preset.id,
      expectedWidth: preset.width,
      expectedHeight: preset.height,
      webglProof,
      hasAudioTrack,
      hasVoiceover,
      audioMetrics,
    });

    const hasFail = gates.some((g) => g.status === 'FAIL' || g.status === 'BLOCKED');
    const report = {
      checkedAtUtc: new Date().toISOString(),
      outputPreset: preset.id,
      expectedWidth: preset.width,
      expectedHeight: preset.height,
      overallStatus: hasFail ? 'FAIL' : 'PASS',
      gates,
      ffprobe: raw.ffprobe,
      frame0Qa: raw.frame0_qa,
      motion: raw.motion,
      detail4k: raw.detail_4k,
      webglProof,
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

export function evaluateAudioMixGate({ hasAudioTrack, hasVoiceover, audioMetrics }) {
  if (!hasVoiceover) {
    if (!hasAudioTrack) {
      return {
        id: 'audio_track',
        label: 'Âm thanh & mức trộn tuyến tính -6 dB',
        status: 'UNVERIFIED',
        detail: 'Không có track âm thanh và không có lời thoại; chế độ im lặng kỹ thuật.',
      };
    }
    return {
      id: 'audio_track',
      label: 'Âm thanh & mức trộn tuyến tính -6 dB',
      status: 'UNVERIFIED',
      detail: 'Có track nhạc/SFX AAC nhưng không có lời thoại người thật; kiểm tra lời thoại & tỷ lệ trộn ở trạng thái UNVERIFIED.',
    };
  }

  // Strict Phase H validation when hasVoiceover === true (NEVER fallback PASS on hasAudioTrack alone!)
  if (!hasAudioTrack) {
    return {
      id: 'audio_track',
      label: 'Âm thanh & mức trộn tuyến tính -6 dB',
      status: 'FAIL',
      detail: 'Dự án có gắn lời thoại nhưng MP4 đầu ra thiếu track âm thanh AAC.',
    };
  }
  if (!audioMetrics || typeof audioMetrics !== 'object') {
    return {
      id: 'audio_track',
      label: 'Âm thanh & mức trộn tuyến tính -6 dB',
      status: 'FAIL',
      detail: 'Thiếu số liệu đo lường trộn âm thanh thực tế (audioMetrics); từ chối fallback PASS.',
    };
  }

  const ratio = Number(audioMetrics.music_measured_ratio);
  const voiceRms = Number(audioMetrics.narration_gated_rms);
  const allFinite = audioMetrics.all_samples_finite !== false && Number.isFinite(ratio) && Number.isFinite(voiceRms);

  if (!allFinite || voiceRms <= 1e-6) {
    return {
      id: 'audio_track',
      label: 'Âm thanh & mức trộn tuyến tính -6 dB',
      status: 'FAIL',
      detail: `Số đo âm thanh lời thoại không hợp lệ hoặc bị rỗng (voiceRms=${audioMetrics.narration_gated_rms}, ratio=${audioMetrics.music_measured_ratio}).`,
    };
  }

  if (Math.abs(ratio - 0.5) > 0.025) {
    return {
      id: 'audio_track',
      label: 'Âm thanh & mức trộn tuyến tính -6 dB',
      status: 'FAIL',
      detail: `Tỷ lệ nhạc/thoại ${ratio.toFixed(4)} (${audioMetrics.music_measured_db_rel_narration ?? 'n/a'} dB) lệch khỏi chuẩn -6.02 dB (0.50 ± 0.025).`,
    };
  }

  return {
    id: 'audio_track',
    label: 'Âm thanh & mức trộn tuyến tính -6 dB',
    status: 'PASS',
    detail: `Đạt chuẩn tuyến tính: tỷ lệ nhạc/thoại=${ratio.toFixed(4)} (${audioMetrics.music_measured_db_rel_narration} dB), gated_rms=${voiceRms.toFixed(4)}.`,
  };
}

export function evaluateNative4kGate({ outputPreset, expectedWidth, expectedHeight, ffprobe, frame0_qa, webglProof, detail_4k }) {
  if (outputPreset !== 'native_4k' && expectedWidth !== 2160) {
    return {
      id: 'resolution_profile',
      label: 'Độ phân giải đầu ra 1080×1920',
      status: ffprobe?.width === 1080 && ffprobe?.height === 1920 && frame0_qa?.dims_ok ? 'PASS' : 'FAIL',
      detail: `MP4=${ffprobe?.width}x${ffprobe?.height}, frame0=${frame0_qa?.width}x${frame0_qa?.height}`,
    };
  }

  const mp4Ok = ffprobe?.width === 2160 && ffprobe?.height === 3840;
  const frameOk = frame0_qa?.width === 2160 && frame0_qa?.height === 3840;
  const webglOk = Boolean(
    webglProof &&
      webglProof.nativeDrawingBufferWidth === 2160 &&
      webglProof.nativeDrawingBufferHeight === 3840 &&
      !webglProof.upscaledFromLowerRes
  );
  const opticalOk = detail_4k ? Boolean(detail_4k.is_native_detail_ok) : true;

  if (!mp4Ok || !frameOk || !webglOk || !opticalOk) {
    return {
      id: 'native_4k_proof',
      label: 'Chứng nhận Native 4K 2160×3840 (không upscale)',
      status: 'FAIL',
      detail: `mp4=${ffprobe?.width}x${ffprobe?.height}, frame0=${frame0_qa?.width}x${frame0_qa?.height}, webglBuf=${webglProof?.nativeDrawingBufferWidth || 'missing'}x${webglProof?.nativeDrawingBufferHeight || 'missing'}, opticalNative=${opticalOk}${detail_4k ? ` (hfRatio=${detail_4k.hf_residual_p99})` : ''}`,
    };
  }

  return {
    id: 'native_4k_proof',
    label: 'Chứng nhận Native 4K 2160×3840 (không upscale)',
    status: 'PASS',
    detail: `Xác nhận WebGL drawingBuffer=2160×3840, khung hình & MP4 2160×3840, chi tiết biên native (hf_p99=${detail_4k?.hf_residual_p99 ?? 'n/a'}).`,
  };
}

export function summarizeQAGates({
  ffprobe,
  frame_count_on_disk,
  expectedFrameCount,
  outputPreset = 'standard',
  expectedWidth = 1080,
  expectedHeight = 1920,
  frame0_qa,
  motion,
  detail_4k = null,
  webglProof = null,
  freeze_black_hits,
  hasAudioTrack,
  hasVoiceover,
  audioMetrics,
}) {
  const framesMatch = frame_count_on_disk === expectedFrameCount;
  const noFreezeBlack =
    Array.isArray(freeze_black_hits) &&
    freeze_black_hits.length === 0 &&
    !motion?.freeze_threshold_exceeded;

  const gates = [
    {
      id: 'mp4_format',
      label: `Định dạng MP4 H.264 ${expectedWidth}×${expectedHeight} 30fps (yuv420p + faststart)`,
      status: ffprobe?.ok ? 'PASS' : 'FAIL',
      detail: ffprobe
        ? `${ffprobe.video_codec} ${ffprobe.width}x${ffprobe.height} @ ${ffprobe.fps}fps (${ffprobe.pix_fmt}), faststart=${ffprobe.faststart}, duration=${ffprobe.duration_seconds}s`
        : 'Thiếu dữ liệu FFprobe',
    },
    evaluateNative4kGate({
      outputPreset,
      expectedWidth,
      expectedHeight,
      ffprobe,
      frame0_qa,
      webglProof,
      detail_4k,
    }),
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
    evaluateAudioMixGate({ hasAudioTrack, hasVoiceover, audioMetrics }),
    {
      id: 'human_visual_review',
      label: 'Mắt người duyệt bố cục cuối cùng',
      status: 'UNVERIFIED',
      detail: 'Tự động kiểm tra bằng máy đã xong; cần người dùng xem lại video thực tế trước khi phát hành.',
    },
  ];
  return gates;
}
