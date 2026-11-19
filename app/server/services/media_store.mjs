/**
 * Confined media upload validation, FFprobe inspection, and safe export resolution.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-02).
 * Security guarantees:
 * - Rejects non-audio uploads, HTML/SVG/JS disguised extensions, and path traversal.
 * - Sniffs file header magic bytes and verifies real audio stream via FFprobe.
 * - Uses execFile (argument arrays only, zero shell interpolation).
 */

import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { atomicWriteFileSync } from '../../../tools/render/frame_runner.mjs';
import { StoreError } from './project_store.mjs';

const execFileAsync = promisify(execFile);

export const MAX_VOICEOVER_BYTES = 32 * 1024 * 1024; // 32 MiB
export const MAX_VOICEOVER_DURATION_S = 120.0;
const ALLOWED_EXTS = new Set(['.wav', '.mp3', '.m4a']);
const SAFE_EXPORT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

function sniffAudioMagic(buf, ext) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  // Reject obvious text/markup scripts regardless of extension
  const headText = buf.subarray(0, 64).toString('utf8').trimStart().toLowerCase();
  if (
    headText.startsWith('<!doctype') ||
    headText.startsWith('<html') ||
    headText.startsWith('<svg') ||
    headText.startsWith('<script')
  ) {
    return false;
  }

  if (ext === '.wav') {
    return buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WAVE';
  }
  if (ext === '.mp3') {
    const isId3 = buf.subarray(0, 3).toString('ascii') === 'ID3';
    const isSync = buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
    return isId3 || isSync;
  }
  if (ext === '.m4a') {
    return buf.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  return false;
}

export async function probeMedia(filePath) {
  let stdout;
  try {
    const res = await execFileAsync(
      'ffprobe',
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
      { timeout: 15000 }
    );
    stdout = res.stdout;
  } catch (err) {
    throw new StoreError(`FFprobe không thể đọc tệp âm thanh: ${err.message}`, 'MEDIA_INVALID', 400);
  }

  let data;
  try {
    data = JSON.parse(stdout);
  } catch {
    throw new StoreError('FFprobe trả dữ liệu không hợp lệ.', 'MEDIA_INVALID', 400);
  }

  const audioStreams = (data.streams || []).filter((s) => s.codec_type === 'audio');
  if (audioStreams.length === 0) {
    throw new StoreError('Tệp không chứa luồng âm thanh (audio stream) hợp lệ.', 'MEDIA_INVALID', 400);
  }
  const a = audioStreams[0];
  const duration = Number(data.format?.duration || a.duration || 0);
  if (!Number.isFinite(duration) || duration <= 0.25 || duration > MAX_VOICEOVER_DURATION_S) {
    throw new StoreError(
      `Thời lượng âm thanh (${duration.toFixed(2)}s) không nằm trong giới hạn 0.25s–${MAX_VOICEOVER_DURATION_S}s.`,
      'MEDIA_INVALID',
      400
    );
  }

  return {
    codec: String(a.codec_name || 'unknown'),
    sampleRate: Number(a.sample_rate || 0),
    channels: Number(a.channels || 0),
    durationSeconds: Number(duration.toFixed(4)),
    formatName: String(data.format?.format_name || ''),
  };
}

export function createMediaStore(projectStore) {
  async function importVoiceover(projectId, { filename, mimeType, buffer }) {
    const { safeId, dir } = projectStore.resolveProjectDir(projectId);
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new StoreError('Tệp lời thoại rỗng.', 'MEDIA_INVALID', 400);
    }
    if (buffer.length > MAX_VOICEOVER_BYTES) {
      throw new StoreError('Tệp lời thoại vượt quá giới hạn 32 MB.', 'MEDIA_INVALID', 413);
    }

    const baseName = path.basename(String(filename || ''));
    const ext = path.extname(baseName).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      throw new StoreError(
        `Định dạng "${ext || 'không rõ'}" không được hỗ trợ. Chỉ chấp nhận WAV, MP3 hoặc M4A.`,
        'MEDIA_INVALID',
        400
      );
    }

    if (!sniffAudioMagic(buffer, ext)) {
      throw new StoreError(
        'Nội dung tệp không khớp với định dạng âm thanh WAV/MP3/M4A hợp lệ.',
        'MEDIA_INVALID',
        400
      );
    }

    const assetsDir = path.join(dir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    const sha = crypto.createHash('sha256').update(buffer).digest('hex');
    const safeStoredName = `voiceover_${sha.slice(0, 12)}${ext}`;
    const tempProbePath = path.join(assetsDir, `.probe_${crypto.randomBytes(6).toString('hex')}${ext}`);
    const finalPath = path.join(assetsDir, safeStoredName);

    let probed;
    try {
      fs.writeFileSync(tempProbePath, buffer);
      probed = await probeMedia(tempProbePath);
      atomicWriteFileSync(finalPath, buffer);
    } finally {
      if (fs.existsSync(tempProbePath)) {
        fs.unlinkSync(tempProbePath);
      }
    }

    return {
      projectId: safeId,
      voiceover: {
        storedFilename: safeStoredName,
        originalFilename: baseName.replace(/[\x00-\x1F\x7F<>`]/g, '_').slice(0, 100),
        relPath: `assets/${safeStoredName}`,
        mimeType: mimeType || null,
        bytes: buffer.length,
        sha256: sha,
        durationSeconds: probed.durationSeconds,
        codec: probed.codec,
        sampleRate: probed.sampleRate,
        channels: probed.channels,
        importedAtUtc: new Date().toISOString(),
      },
    };
  }

  function resolveVoiceoverPath(projectId, relPath) {
    const { dir } = projectStore.resolveProjectDir(projectId);
    if (!relPath || typeof relPath !== 'string' || !relPath.startsWith('assets/')) {
      return null;
    }
    const assetsRoot = path.resolve(dir, 'assets');
    const target = path.resolve(dir, relPath);
    const rel = path.relative(assetsRoot, target);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
      return null;
    }
    return fs.existsSync(target) ? target : null;
  }

  function getSafeExportFile(projectId, exportId) {
    const { safeId, dir } = projectStore.resolveProjectDir(projectId);
    if (!SAFE_EXPORT_ID_RE.test(String(exportId || ''))) {
      throw new StoreError('Mã exportId không hợp lệ.', 'INVALID_EXPORT_ID', 400);
    }
    const rendersRoot = path.resolve(dir, 'renders');
    const target = path.resolve(rendersRoot, exportId, 'output.mp4');
    const rel = path.relative(rendersRoot, target);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new StoreError('Đường dẫn tệp xuất không hợp lệ.', 'PATH_SECURITY_ERROR', 403);
    }
    if (!fs.existsSync(target)) {
      throw new StoreError('Không tìm thấy tệp MP4 đã xuất.', 'EXPORT_NOT_FOUND', 404);
    }
    const stat = fs.statSync(target);
    if (!stat.isFile() || stat.size === 0) {
      throw new StoreError('Tệp MP4 rỗng hoặc chưa hoàn tất.', 'QA_FAILED', 500);
    }
    return {
      projectId: safeId,
      exportId,
      filePath: target,
      bytes: stat.size,
      downloadName: `${safeId}-${exportId}.mp4`,
      qaPath: path.resolve(rendersRoot, exportId, 'qa.json'),
    };
  }

  return {
    importVoiceover,
    resolveVoiceoverPath,
    getSafeExportFile,
  };
}
