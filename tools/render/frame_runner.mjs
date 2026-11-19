/**
 * Safe frame capture utilities: atomic write, disk preflight, PNG/JPEG header validation,
 * hash-validated RESUME, finite transient retry, and SIGINT/SIGTERM cleanup registry.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_LOW_WATERMARK_BYTES = 2048 * 1024 * 1024; // 2 GiB

export class DiskPreflightError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'DiskPreflightError';
    this.code = 'LOW_DISK_SPACE';
    this.details = details;
  }
}

export function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

export function atomicWriteFileSync(destPath, dataBuffer) {
  const resolved = path.resolve(destPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const tmpPath = path.join(
    path.dirname(resolved),
    `.${path.basename(resolved)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
  );
  try {
    const fd = fs.openSync(tmpPath, 'w');
    try {
      fs.writeFileSync(fd, dataBuffer);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmpPath, resolved);
    return resolved;
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // ignore cleanup failure
      }
    }
    throw err;
  }
}

export function parseImageDimensions(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) {
    return null;
  }
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return {
      format: 'png',
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
    };
  }
  // JPEG signature: FF D8
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > buf.length) break;
      const len = buf.readUInt16BE(offset);
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        if (offset + 7 <= buf.length) {
          return {
            format: 'jpeg',
            height: buf.readUInt16BE(offset + 3),
            width: buf.readUInt16BE(offset + 5),
          };
        }
      }
      if (len < 2) break;
      offset += len;
    }
  }
  return null;
}

export function checkDiskPreflight(targetDir, { estimatedBytes = 0, lowWatermarkBytes = DEFAULT_LOW_WATERMARK_BYTES } = {}) {
  let probe = path.resolve(targetDir);
  while (!fs.existsSync(probe) && probe !== path.dirname(probe)) {
    probe = path.dirname(probe);
  }
  const stat = fs.statfsSync(probe);
  const freeBytes = Number(stat.bavail) * Number(stat.bsize);
  const needed = Math.max(0, Number(estimatedBytes)) + Math.max(0, Number(lowWatermarkBytes));
  const report = {
    probePath: probe,
    freeBytes,
    freeMb: Number((freeBytes / (1024 * 1024)).toFixed(2)),
    estimatedBytes: Math.max(0, Number(estimatedBytes)),
    lowWatermarkBytes: Math.max(0, Number(lowWatermarkBytes)),
    requiredBytes: needed,
    ok: freeBytes >= needed,
  };
  if (!report.ok) {
    throw new DiskPreflightError(
      `Low disk space at ${probe}: free=${report.freeMb} MB, required>=${(needed / (1024 * 1024)).toFixed(2)} MB`,
      report
    );
  }
  return report;
}

export function canonicalFrameName(frameIndex, ext = 'png') {
  return `frame_${String(frameIndex).padStart(6, '0')}.${ext}`;
}

export function validateExistingResumeFrame(
  filePath,
  expectedSha256,
  expectedWidth = 1080,
  expectedHeight = 1920,
  manifestMeta = null,
  expectedProfile = null
) {
  if (manifestMeta && (manifestMeta.width !== expectedWidth || manifestMeta.height !== expectedHeight)) {
    return {
      valid: false,
      reason: 'manifest_dimension_mismatch',
      manifestWidth: manifestMeta.width,
      manifestHeight: manifestMeta.height,
    };
  }
  if (expectedProfile?.outputPreset && manifestMeta?.outputPreset && manifestMeta.outputPreset !== expectedProfile.outputPreset) {
    return { valid: false, reason: 'manifest_preset_mismatch' };
  }
  if (expectedProfile?.visualFoundation && manifestMeta?.visualFoundation && manifestMeta.visualFoundation !== expectedProfile.visualFoundation) {
    return { valid: false, reason: 'manifest_visual_mode_mismatch' };
  }
  if (!fs.existsSync(filePath)) {
    return { valid: false, reason: 'missing' };
  }
  const buf = fs.readFileSync(filePath);
  const dims = parseImageDimensions(buf);
  if (!dims || dims.width !== expectedWidth || dims.height !== expectedHeight) {
    return { valid: false, reason: 'invalid_dimensions_or_corrupt', dims };
  }
  const actualSha = sha256Buffer(buf);
  if (!expectedSha256 || actualSha !== expectedSha256) {
    return { valid: false, reason: 'hash_mismatch', actualSha, expectedSha256 };
  }
  return { valid: true, sha256: actualSha, dims, bytes: buf.length };
}

export async function withFiniteRetry(fn, { maxRetries = 2, isTransient = () => true, delayMs = 200 } = {}) {
  let attempt = 0;
  let lastErr;
  while (attempt <= maxRetries) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt >= maxRetries || !isTransient(err)) {
        throw err;
      }
      attempt += 1;
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw lastErr;
}

export function registerCleanupHandlers(cleanupFn) {
  let cleaned = false;
  const runOnce = async (signal) => {
    if (cleaned) return;
    cleaned = true;
    try {
      await cleanupFn(signal);
    } finally {
      if (signal) {
        process.exit(signal === 'SIGINT' ? 130 : 143);
      }
    }
  };
  const onSigInt = () => void runOnce('SIGINT');
  const onSigTerm = () => void runOnce('SIGTERM');
  process.once('SIGINT', onSigInt);
  process.once('SIGTERM', onSigTerm);
  return () => {
    process.removeListener('SIGINT', onSigInt);
    process.removeListener('SIGTERM', onSigTerm);
  };
}
