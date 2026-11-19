/**
 * Asynchronous bounded render job manager with persistent state, SSE streaming,
 * real frame-count progress polling, process-tree cancellation, and QA gate checks.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-02).
 */

import { execFile, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { checkOriginalEngineFiles, EngineInputBlockedError } from '../../../engine/adapters/renderer_adapter.mjs';
import { atomicWriteFileSync } from '../../../tools/render/frame_runner.mjs';
import { RENDER_CONTRACT, resolveOutputPreset, validateFrameRange } from '../../shared/contract.mjs';
import { deriveFrameCount, TEMPLATES } from '../../shared/project_schema.mjs';
import { StoreError } from './project_store.mjs';

const execFileAsync = promisify(execFile);

const SAFE_JOB_ID_RE = /^[a-zA-Z0-9._-]+$/;
const SAFE_EXPORT_ID_RE = /^[a-zA-Z0-9._-]+$/;
const MIN_FREE_DISK_BYTES = 256 * 1024 * 1024; // 256 MiB preflight floor
const ACTIVE_STATUSES = new Set([
  'queued',
  'preparing',
  'frames',
  'audio',
  'encoding',
  'qa',
  'canceling',
  'running',
]);

export function checkDiskPreflight(targetDir, minFreeBytes = MIN_FREE_DISK_BYTES) {
  fs.mkdirSync(targetDir, { recursive: true });
  if (typeof fs.statfsSync !== 'function') {
    return { checked: false, freeBytes: null, ok: true };
  }
  const st = fs.statfsSync(targetDir);
  const freeBytes = Number(st.bavail) * Number(st.bsize);
  if (!Number.isFinite(freeBytes) || freeBytes < minFreeBytes) {
    throw new StoreError(
      `Dung lượng đĩa trống không đủ để kết xuất (${Math.round(freeBytes / (1024 * 1024))} MB < ${Math.round(minFreeBytes / (1024 * 1024))} MB).`,
      'DISK_FULL',
      507
    );
  }
  return { checked: true, freeBytes, ok: true };
}

function killProcessTree(child) {
  if (!child || !child.pid) return Promise.resolve();
  const pid = child.pid;
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => resolve());
    });
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore if already exited
    }
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {
          // already gone
        }
      }
      resolve();
    }, 800);
  });
}

function countRenderedFrames(framesDir, startFrame, endFrame, ext) {
  if (!fs.existsSync(framesDir)) return 0;
  let count = 0;
  const entries = fs.readdirSync(framesDir);
  const suffix = `.${ext}`;
  for (const name of entries) {
    if (!name.startsWith('frame_') || !name.endsWith(suffix)) continue;
    const numStr = name.slice(6, name.length - suffix.length);
    const idx = Number.parseInt(numStr, 10);
    if (Number.isInteger(idx) && idx >= startFrame && idx <= endFrame) {
      count += 1;
    }
  }
  return count;
}

export function createJobManager(
  projectRoot,
  { projectStore, mediaStore, previewManager, qaService }
) {
  const jobsRoot = path.join(projectRoot, 'workspace', 'jobs');
  const pythonBin = process.env.PYTHON_BIN || 'python';
  fs.mkdirSync(jobsRoot, { recursive: true });

  const jobsCache = new Map();
  const subscribers = new Map(); // jobId -> Set<resOrFn>
  const activeRunState = new Map(); // jobId -> { cancelRequested, child }
  const jobQueue = [];
  let runningJobId = null;
  let runningPromise = null;

  function jobFilePath(jobId) {
    if (!SAFE_JOB_ID_RE.test(String(jobId || ''))) {
      throw new StoreError('Mã tác vụ (jobId) không hợp lệ.', 'INVALID_JOB_ID', 400);
    }
    const target = path.resolve(jobsRoot, `${jobId}.json`);
    const rel = path.relative(path.resolve(jobsRoot), target);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new StoreError('Đường dẫn tác vụ không hợp lệ.', 'PATH_SECURITY_ERROR', 403);
    }
    return target;
  }

  function persistJob(job) {
    const file = jobFilePath(job.jobId);
    atomicWriteFileSync(file, Buffer.from(JSON.stringify(job, null, 2) + '\n', 'utf8'));
    jobsCache.set(job.jobId, structuredClone(job));
  }

  function emitJobEvent(jobId, eventName, job) {
    const subs = subscribers.get(jobId);
    if (!subs || subs.size === 0) return;
    const snapshot = structuredClone(job);
    for (const fn of subs) {
      try {
        fn(eventName, snapshot);
      } catch {
        // ignore broken subscriber
      }
    }
  }

  function recoverInterruptedJobs() {
    if (!fs.existsSync(jobsRoot)) return [];
    const recovered = [];
    for (const name of fs.readdirSync(jobsRoot)) {
      if (!name.endsWith('.json')) continue;
      const full = path.join(jobsRoot, name);
      try {
        const job = JSON.parse(fs.readFileSync(full, 'utf8'));
        if (job && job.jobId) {
          if (ACTIVE_STATUSES.has(job.status)) {
            job.status = 'interrupted';
            job.stage = 'interrupted';
            job.message = 'Tác vụ bị gián đoạn khi máy chủ khởi động lại.';
            job.error = {
              code: 'JOB_INTERRUPTED',
              message: 'Tiến trình kết xuất bị ngắt trước khi hoàn thành.',
              retryable: true,
            };
            job.finishedAtUtc = job.finishedAtUtc || new Date().toISOString();
            job.updatedAtUtc = new Date().toISOString();
            persistJob(job);
            recovered.push(job.jobId);
          } else {
            jobsCache.set(job.jobId, job);
          }
        }
      } catch {
        // ignore corrupt leftover
      }
    }
    return recovered;
  }

  recoverInterruptedJobs();

  function getJob(jobId) {
    if (jobsCache.has(jobId)) {
      return structuredClone(jobsCache.get(jobId));
    }
    const file = jobFilePath(jobId);
    if (!fs.existsSync(file)) {
      throw new StoreError(`Không tìm thấy tác vụ "${jobId}".`, 'JOB_NOT_FOUND', 404);
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    jobsCache.set(jobId, parsed);
    return structuredClone(parsed);
  }

  function listJobs(projectId = null) {
    const out = [];
    if (fs.existsSync(jobsRoot)) {
      for (const name of fs.readdirSync(jobsRoot)) {
        if (!name.endsWith('.json')) continue;
        try {
          const job = JSON.parse(fs.readFileSync(path.join(jobsRoot, name), 'utf8'));
          if (!projectId || job.projectId === projectId) {
            out.push(job);
          }
        } catch {
          // skip
        }
      }
    }
    out.sort((a, b) => String(b.createdAtUtc || '').localeCompare(String(a.createdAtUtc || '')));
    return out;
  }

  function updateJob(jobId, mutator, eventName = 'progress') {
    const cur = getJob(jobId);
    mutator(cur);
    cur.updatedAtUtc = new Date().toISOString();
    persistJob(cur);
    emitJobEvent(jobId, eventName, cur);
    return cur;
  }

  function appendLog(job, message) {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${message}`;
    job.logs = [...(job.logs || []).slice(-49), line];
  }

  function runTrackedCommand(jobId, command, args, { cwd = projectRoot, timeoutMs = 600_000, onTick = null } = {}) {
    const runState = activeRunState.get(jobId);
    if (!runState || runState.cancelRequested) {
      return Promise.reject(new StoreError('Tác vụ đã bị hủy.', 'JOB_CANCELED', 409));
    }

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        detached: process.platform !== 'win32',
      });
      runState.child = child;

      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (chunk) => {
        stdout = (stdout + chunk.toString('utf8')).slice(-32768);
      });
      child.stderr?.on('data', (chunk) => {
        stderr = (stderr + chunk.toString('utf8')).slice(-32768);
      });

      const tickTimer = onTick ? setInterval(() => onTick(), 380) : null;
      const killTimer = setTimeout(() => {
        void killProcessTree(child);
        reject(new StoreError(`Tiến trình vượt quá thời gian chờ (${Math.round(timeoutMs / 1000)}s).`, 'JOB_TIMEOUT', 504));
      }, timeoutMs);

      child.on('error', (err) => {
        if (tickTimer) clearInterval(tickTimer);
        clearTimeout(killTimer);
        if (runState.child === child) runState.child = null;
        reject(err);
      });

      child.on('close', (code) => {
        if (tickTimer) clearInterval(tickTimer);
        clearTimeout(killTimer);
        if (runState.child === child) runState.child = null;
        if (runState.cancelRequested) {
          reject(new StoreError('Tác vụ đã bị hủy theo yêu cầu người dùng.', 'JOB_CANCELED', 409));
          return;
        }
        if (code !== 0) {
          const detail = (stderr || stdout || `Exit code ${code}`).trim().slice(-800);
          reject(new StoreError(`Tiến trình thất bại (${code}): ${detail}`, 'RENDER_PROCESS_FAILED', 500));
          return;
        }
        resolve({ code, stdout, stderr });
      });
    });
  }

  async function executeJob(jobId) {
    const job = getJob(jobId);
    const runState = { cancelRequested: false, child: null };
    activeRunState.set(jobId, runState);

    const { dir: projectDir } = projectStore.resolveProjectDir(job.projectId);
    const exportDir = path.join(projectDir, 'renders', job.exportId);
    const framesDir = path.join(projectDir, 'frames', job.exportId);
    const workAudioDir = path.join(projectDir, 'renders', job.exportId, '_audio');
    const mp4Path = path.join(exportDir, 'output.mp4');
    const qaPath = path.join(exportDir, 'qa.json');
    const reportPath = path.join(exportDir, 'render_report.json');
    const frameExt = job.format === 'png' ? 'png' : 'jpg';

    try {
      const snap = await projectStore.snapshotProjectRevision(job.projectId);
      const project = snap.project;
      const tpl = TEMPLATES[project.templateId];

      updateJob(jobId, (j) => {
        j.status = 'preparing';
        j.stage = 'preparing';
        j.progress = 3;
        j.startedAtUtc = j.startedAtUtc || new Date().toISOString();
        j.message = 'Đang chuẩn bị cấu hình & giải phóng phiên xem trước...';
        appendLog(j, `Chuẩn bị kết xuất ${j.totalFrames} khung (${j.startFrame}..${j.endFrame})`);
      });

      checkDiskPreflight(exportDir);
      fs.mkdirSync(exportDir, { recursive: true });
      fs.mkdirSync(framesDir, { recursive: true });
      fs.mkdirSync(workAudioDir, { recursive: true });

      if (previewManager) {
        await previewManager.disposeAllSessions();
      }
      if (runState.cancelRequested) {
        throw new StoreError('Tác vụ đã bị hủy.', 'JOB_CANCELED', 409);
      }

      updateJob(jobId, (j) => {
        j.status = 'frames';
        j.stage = 'frames';
        j.progress = 6;
        j.message = `Đang kết xuất khung hình Three.js (0/${j.totalFrames})...`;
        appendLog(j, `Khởi chạy render_parallel.mjs (${j.workers} worker)`);
      });

      const preset = resolveOutputPreset(job.outputPreset || 'standard');
      const renderArgs = [
        'tools/render/render_parallel.mjs',
        '--project-id',
        project.projectId,
        '--web-dir',
        tpl.webDirRel,
        '--out-dir',
        framesDir,
        '--start',
        String(job.startFrame),
        '--end',
        String(job.endFrame),
        '--format',
        job.format,
        '--quality',
        String(job.quality),
        '--workers',
        String(job.workers),
        '--output-preset',
        preset.id,
        '--report',
        reportPath,
      ];
      if (snap.overridesPath) {
        renderArgs.push('--overrides-file', snap.overridesPath);
      }

      const framesStartTime = Date.now();
      let lastReportedCount = -1;
      await runTrackedCommand(jobId, process.execPath, renderArgs, {
        timeoutMs: preset.id === 'native_4k' ? 1_800_000 : 900_000,
        onTick: () => {
          const done = countRenderedFrames(framesDir, job.startFrame, job.endFrame, frameExt);
          if (done !== lastReportedCount) {
            lastReportedCount = done;
            const frac = Math.min(1, done / Math.max(1, job.totalFrames));
            const elapsedS = Math.max(0.5, (Date.now() - framesStartTime) / 1000);
            const rate = done / elapsedS;
            const eta = done > 1 && rate > 0 ? Math.max(0, Math.round((job.totalFrames - done) / rate)) : null;
            updateJob(jobId, (j) => {
              j.completedFrames = done;
              j.progress = Math.round(6 + frac * 69);
              j.etaSeconds = eta;
              j.message = `Đang kết xuất khung hình (${done}/${j.totalFrames})...`;
            });
          }
        },
      });

      const finalRendered = countRenderedFrames(framesDir, job.startFrame, job.endFrame, frameExt);
      if (finalRendered < job.totalFrames) {
        throw new StoreError(
          `Thiếu khung hình sau kết xuất: ${finalRendered}/${job.totalFrames}.`,
          'FRAME_COUNT_MISMATCH',
          500
        );
      }

      updateJob(jobId, (j) => {
        j.completedFrames = finalRendered;
        j.status = 'audio';
        j.stage = 'audio';
        j.progress = 78;
        j.etaSeconds = 5;
        j.message = 'Đang xử lý & trộn âm thanh (48kHz / -6 dB)...';
        appendLog(j, `Đã kết xuất đủ ${finalRendered} khung hình; bắt đầu xử lý âm thanh`);
      });

      const musicWav = path.join(workAudioDir, 'music.wav');
      const sfxWav = path.join(workAudioDir, 'sfx.wav');
      const finalAudioWav = path.join(workAudioDir, 'final_mix.wav');
      await runTrackedCommand(
        jobId,
        pythonBin,
        [
          'tools/audio/template_audio.py',
          '--template',
          project.templateId,
          '--frames',
          String(job.totalFrames),
          '--music-out',
          musicWav,
          '--sfx-out',
          sfxWav,
          ...(project.voiceover ? [] : ['--combined-out', finalAudioWav]),
        ],
        { timeoutMs: 60_000 }
      );

      let audioMetrics = {
        mode: 'synthetic_music_sfx_only',
        hasVoiceover: false,
      };
      const voRel = project.voiceover?.relPath;
      const voSrc = voRel ? mediaStore.resolveVoiceoverPath(project.projectId, voRel) : null;
      if (project.voiceover && !voSrc) {
        throw new StoreError('Không tìm thấy tệp lời thoại đã gắn trên đĩa.', 'MEDIA_MISSING', 409);
      }
      if (voSrc) {
        const voPcmWav = path.join(workAudioDir, 'voiceover_48k.wav');
        const clipSeconds = (job.totalFrames / RENDER_CONTRACT.fps).toFixed(4);
        const ffArgs = ['-y', '-i', voSrc];
        if (job.mode === 'bounded' || project.syncDurationToVoiceover === false) {
          ffArgs.push('-t', clipSeconds);
        }
        ffArgs.push('-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', voPcmWav);
        await runTrackedCommand(jobId, 'ffmpeg', ffArgs, { timeoutMs: 60_000 });

        const mixRes = await runTrackedCommand(
          jobId,
          pythonBin,
          [
            'tools/audio/mix.py',
            '--narration',
            voPcmWav,
            '--music',
            musicWav,
            '--sfx',
            sfxWav,
            '--out',
            finalAudioWav,
          ],
          { timeoutMs: 60_000 }
        );
        try {
          audioMetrics = {
            mode: 'voiceover_linear_gated_rms',
            hasVoiceover: true,
            ...JSON.parse(mixRes.stdout),
          };
        } catch {
          audioMetrics = { mode: 'voiceover_linear_gated_rms', hasVoiceover: true };
        }
      }

      updateJob(jobId, (j) => {
        j.status = 'encoding';
        j.stage = 'encoding';
        j.progress = 86;
        j.etaSeconds = 3;
        j.message = 'Đang đóng gói MP4 H.264 / yuv420p / AAC...';
        appendLog(j, 'Đóng gói MP4 qua tools/qa/export_mp4.py');
      });

      const encodeDir = prepareSequentialFramesDir(framesDir, job.startFrame, job.endFrame, frameExt, workAudioDir);
      const pattern = `frame_%06d.${frameExt}`;
      const encodePy = [
        'import json, sys',
        'from pathlib import Path',
        `sys.path.insert(0, ${JSON.stringify(path.join(projectRoot, 'tools', 'qa'))})`,
        'import export_mp4',
        `res = export_mp4.export_frames_to_mp4(Path(${JSON.stringify(encodeDir)}), Path(${JSON.stringify(mp4Path)}), fps=30, frame_pattern=${JSON.stringify(pattern)}, audio_wav=Path(${JSON.stringify(finalAudioWav)}), timeout_seconds=360, expected_width=${preset.width}, expected_height=${preset.height})`,
        'print(json.dumps(res))',
      ].join('\n');
      await runTrackedCommand(jobId, pythonBin, ['-c', encodePy], { timeoutMs: 360_000 });

      let webglProof = null;
      if (fs.existsSync(reportPath)) {
        try {
          webglProof = JSON.parse(fs.readFileSync(reportPath, 'utf8'))?.webglProof || null;
        } catch {
          webglProof = null;
        }
      }

      updateJob(jobId, (j) => {
        j.status = 'qa';
        j.stage = 'qa';
        j.progress = 94;
        j.etaSeconds = 1;
        j.message = 'Đang kiểm định chất lượng FFprobe, độ chuyển động & âm thanh...';
        appendLog(j, 'Chạy QA service trên MP4 vừa xuất');
      });

      const qaReport = await qaService.runExportQA({
        mp4Path,
        framesDir,
        expectedFrameCount: job.totalFrames,
        outputPreset: preset.id,
        webglProof,
        hasAudioTrack: true,
        hasVoiceover: Boolean(voSrc),
        audioMetrics,
        qaOutPath: qaPath,
      });

      if (qaReport.overallStatus !== 'PASS') {
        updateJob(
          jobId,
          (j) => {
            j.status = 'failed';
            j.stage = 'qa';
            j.progress = 100;
            j.etaSeconds = 0;
            j.qaSummary = qaReport;
            j.finishedAtUtc = new Date().toISOString();
            j.message = 'Kiểm định QA phát hiện lỗi sau khi đóng gói MP4.';
            j.error = {
              code: 'QA_FAILED',
              message: 'Tệp MP4 không đạt một hoặc nhiều cổng kiểm định QA.',
              retryable: true,
            };
            appendLog(j, 'QA FAIL — xem chi tiết cổng kiểm định');
          },
          'failed'
        );
        return;
      }

      const exportStat = fs.statSync(mp4Path);
      const exportSummary = {
        exportId: job.exportId,
        jobId: job.jobId,
        mode: job.mode,
        outputPreset: preset.id,
        width: preset.width,
        height: preset.height,
        frameCount: job.totalFrames,
        startFrame: job.startFrame,
        endFrame: job.endFrame,
        durationSeconds: Number((job.totalFrames / RENDER_CONTRACT.fps).toFixed(3)),
        bytes: exportStat.size,
        renderHash: project.renderHash,
        revision: project.revision,
        hasVoiceover: Boolean(voSrc),
        qaOverallStatus: qaReport.overallStatus,
        createdAtUtc: new Date().toISOString(),
        videoUrl: `/api/projects/${project.projectId}/exports/${job.exportId}/file`,
        qaUrl: `/api/projects/${project.projectId}/exports/${job.exportId}/qa`,
      };

      await projectStore.updateProjectSystemFields(project.projectId, (p) => {
        p.latestExport = exportSummary;
        return p;
      });

      updateJob(
        jobId,
        (j) => {
          j.status = 'completed';
          j.stage = 'completed';
          j.progress = 100;
          j.etaSeconds = 0;
          j.finishedAtUtc = new Date().toISOString();
          j.exportSummary = exportSummary;
          j.qaSummary = {
            overallStatus: qaReport.overallStatus,
            gates: qaReport.gates,
            checkedAtUtc: qaReport.checkedAtUtc,
          };
          j.message = `Hoàn tất xuất video (${job.totalFrames} khung, ${(exportStat.size / (1024 * 1024)).toFixed(2)} MB).`;
          appendLog(j, `Hoàn tất exportId=${job.exportId}`);
        },
        'completed'
      );
    } catch (err) {
      const isCanceled = runState.cancelRequested || err?.code === 'JOB_CANCELED';
      if (isCanceled && fs.existsSync(mp4Path)) {
        try {
          fs.unlinkSync(mp4Path);
        } catch {
          // ignore
        }
      }
      updateJob(
        jobId,
        (j) => {
          j.status = isCanceled ? 'canceled' : 'failed';
          j.stage = isCanceled ? 'canceled' : j.stage || 'failed';
          j.etaSeconds = 0;
          j.finishedAtUtc = new Date().toISOString();
          j.message = isCanceled ? 'Tác vụ đã được hủy.' : err?.message || 'Lỗi kết xuất video.';
          j.error = isCanceled
            ? { code: 'JOB_CANCELED', message: 'Người dùng đã hủy tác vụ.', retryable: true }
            : {
                code: err?.code || 'JOB_FAILED',
                message: err?.message || 'Lỗi không xác định khi kết xuất.',
                retryable: true,
              };
          appendLog(j, isCanceled ? 'Đã hủy tác vụ & dọn tiến trình con' : `Lỗi: ${j.error.message}`);
        },
        isCanceled ? 'canceled' : 'failed'
      );
    } finally {
      activeRunState.delete(jobId);
      runningJobId = null;
      void pumpQueue();
    }
  }

  function prepareSequentialFramesDir(framesDir, startFrame, endFrame, ext, scratchBase) {
    if (startFrame === 0) return framesDir;
    const seqDir = path.join(scratchBase, 'seq_frames');
    fs.mkdirSync(seqDir, { recursive: true });
    let dstIdx = 0;
    for (let f = startFrame; f <= endFrame; f += 1) {
      const src = path.join(framesDir, `frame_${String(f).padStart(6, '0')}.${ext}`);
      const dst = path.join(seqDir, `frame_${String(dstIdx).padStart(6, '0')}.${ext}`);
      fs.copyFileSync(src, dst);
      dstIdx += 1;
    }
    return seqDir;
  }

  function pumpQueue() {
    if (runningJobId || jobQueue.length === 0) return;
    const nextId = jobQueue.shift();
    if (!nextId) return;
    const job = getJob(nextId);
    if (job.status === 'canceled') {
      pumpQueue();
      return;
    }
    runningJobId = nextId;
    runningPromise = executeJob(nextId).finally(() => {
      runningPromise = null;
    });
  }

  async function enqueueRenderJob(projectId, options = {}) {
    const project = projectStore.readProject(projectId);
    const tpl = TEMPLATES[project.templateId];
    if (!tpl) {
      throw new StoreError(`Template không hợp lệ: ${project.templateId}`, 'INVALID_TEMPLATE', 400);
    }
    if (tpl.requiresOriginalKit) {
      const check = checkOriginalEngineFiles(projectRoot);
      if (!check.ready) {
        throw new EngineInputBlockedError(
          'Bộ engine gốc chưa được cài đặt trên máy để xuất template Soldier.',
          check.missingFiles
        );
      }
    }

    // Prevent timing mismatch renders when voiceover exceeds fixed template
    const timing = deriveFrameCount(project);
    if (timing.syncMode === 'conflict' && timing.conflict) {
      throw new StoreError(timing.conflict.message, timing.conflict.code, 409, timing.conflict);
    }
    if (project.voiceover) {
      const voPath = mediaStore.resolveVoiceoverPath(project.projectId, project.voiceover.relPath);
      if (!voPath) {
        throw new StoreError('Tệp lời thoại gắn với dự án không còn tồn tại.', 'MEDIA_MISSING', 409);
      }
    }

    // Guard against duplicate active job for the same project
    const existingActive = listJobs(project.projectId).find((j) => ACTIVE_STATUSES.has(j.status));
    if (existingActive) {
      throw new StoreError(
        `Dự án "${project.title}" đang có tác vụ kết xuất hoạt động (${existingActive.jobId}).`,
        'JOB_ALREADY_RUNNING',
        409,
        { activeJobId: existingActive.jobId }
      );
    }

    const mode = options.mode === 'bounded' ? 'bounded' : 'full';
    const preset = resolveOutputPreset(options.outputPreset || 'standard');
    const maxFrame = project.durationFrames - 1;
    const startFrame = mode === 'bounded' && Number.isInteger(options.startFrame) ? options.startFrame : 0;
    const endFrame =
      mode === 'bounded'
        ? Number.isInteger(options.endFrame)
          ? options.endFrame
          : Math.min(23, maxFrame)
        : maxFrame;

    validateFrameRange(startFrame, endFrame, project.durationFrames);
    const totalFrames = endFrame - startFrame + 1;
    const requestedWorkers = Number(options.workers || (preset.id === 'native_4k' ? 1 : totalFrames >= 12 ? 2 : 1));
    const workers = preset.id === 'native_4k' ? 1 : requestedWorkers >= 2 ? 2 : 1;
    const format = project.renderPreset?.format === 'png' ? 'png' : 'jpeg';
    const quality = Number(project.renderPreset?.quality || 94);

    const { dir: projectDir } = projectStore.resolveProjectDir(project.projectId);
    const requiredMinDisk =
      preset.id === 'native_4k'
        ? Math.max(MIN_FREE_DISK_BYTES, totalFrames * 2400 * 1024 + 512 * 1024 * 1024)
        : MIN_FREE_DISK_BYTES;
    checkDiskPreflight(projectDir, requiredMinDisk);

    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const rand = crypto.randomBytes(3).toString('hex');
    const jobId = `job_${stamp}_${rand}`;
    const exportId = `exp_${stamp}_${rand}`;
    const now = new Date().toISOString();

    const job = {
      jobId,
      exportId,
      projectId: project.projectId,
      projectTitle: project.title,
      templateId: project.templateId,
      renderHash: project.renderHash,
      mode,
      outputPreset: preset.id,
      width: preset.width,
      height: preset.height,
      startFrame,
      endFrame,
      totalFrames,
      completedFrames: 0,
      workers,
      format,
      quality,
      status: 'queued',
      stage: 'queued',
      progress: 0,
      etaSeconds: null,
      message: 'Đang chờ trong hàng đợi kết xuất...',
      createdAtUtc: now,
      updatedAtUtc: now,
      startedAtUtc: null,
      finishedAtUtc: null,
      exportSummary: null,
      qaSummary: null,
      error: null,
      logs: [`[${now.slice(11, 19)}] Tạo tác vụ ${jobId} (${mode}: ${startFrame}..${endFrame})`],
    };

    persistJob(job);
    jobQueue.push(jobId);
    pumpQueue();
    return getJob(jobId);
  }

  async function cancelJob(jobId) {
    const job = getJob(jobId);
    if (!ACTIVE_STATUSES.has(job.status)) {
      return job;
    }

    const qIdx = jobQueue.indexOf(jobId);
    if (qIdx >= 0) {
      jobQueue.splice(qIdx, 1);
      return updateJob(
        jobId,
        (j) => {
          j.status = 'canceled';
          j.stage = 'canceled';
          j.finishedAtUtc = new Date().toISOString();
          j.etaSeconds = 0;
          j.message = 'Đã hủy tác vụ trước khi chạy.';
          j.error = { code: 'JOB_CANCELED', message: 'Người dùng đã hủy tác vụ.', retryable: true };
          appendLog(j, 'Đã hủy khỏi hàng đợi');
        },
        'canceled'
      );
    }

    const runState = activeRunState.get(jobId);
    if (runState) {
      runState.cancelRequested = true;
      updateJob(jobId, (j) => {
        j.status = 'canceling';
        j.stage = 'canceling';
        j.message = 'Đang dừng tiến trình kết xuất...';
        appendLog(j, 'Yêu cầu hủy tác vụ — đang dọn cây tiến trình con');
      });
      if (runState.child) {
        await killProcessTree(runState.child);
      }
    }
    return getJob(jobId);
  }

  function subscribeJob(jobId, listenerFn) {
    // Validate job exists before subscribing
    const initial = getJob(jobId);
    let set = subscribers.get(jobId);
    if (!set) {
      set = new Set();
      subscribers.set(jobId, set);
    }
    set.add(listenerFn);
    listenerFn('snapshot', initial);
    return () => {
      set.delete(listenerFn);
      if (set.size === 0) {
        subscribers.delete(jobId);
      }
    };
  }

  async function disposeAllJobs() {
    jobQueue.length = 0;
    const pending = runningPromise;
    const ids = Array.from(activeRunState.keys());
    for (const id of ids) {
      await cancelJob(id);
    }
    if (pending) {
      await Promise.race([pending, new Promise((r) => setTimeout(r, 3000))]);
    }
  }

  function getExportQa(projectId, exportId) {
    const { dir } = projectStore.resolveProjectDir(projectId);
    if (!SAFE_EXPORT_ID_RE.test(String(exportId || ''))) {
      throw new StoreError('Mã exportId không hợp lệ.', 'INVALID_EXPORT_ID', 400);
    }
    const rendersRoot = path.resolve(dir, 'renders');
    const target = path.resolve(rendersRoot, exportId, 'qa.json');
    const rel = path.relative(rendersRoot, target);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new StoreError('Đường dẫn báo cáo QA không hợp lệ.', 'PATH_SECURITY_ERROR', 403);
    }
    if (!fs.existsSync(target)) {
      throw new StoreError('Không tìm thấy báo cáo QA cho bản xuất này.', 'QA_NOT_FOUND', 404);
    }
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  }

  return {
    jobsRoot,
    enqueueRenderJob,
    cancelJob,
    getJob,
    listJobs,
    subscribeJob,
    recoverInterruptedJobs,
    disposeAllJobs,
    getExportQa,
  };
}
