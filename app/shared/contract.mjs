/**
 * Shared Engine API contract constants & validators for SHORT-01 / SHORT-02.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01).
 * Enforces 9:16 portrait 1080x1920 30fps Three.js short renderer scope and
 * rejects prohibited substitute engines or 16:9 longform modes.
 */

export const RENDER_CONTRACT = Object.freeze({
  width: 1080,
  height: 1920,
  aspectRatio: '9:16',
  fps: 30,
  videoCodec: 'h264',
  pixelFormat: 'yuv420p',
  audioCodec: 'aac',
  engineFamily: 'threejs-2d-char-3d-world',
  forbiddenEngines: Object.freeze(['skia', 'reachmora', 'remotion', 'moviepy', 'ai-video']),
});

export const GATE_STATUS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  BLOCKED: 'BLOCKED',
  UNVERIFIED: 'UNVERIFIED',
});

export class ContractValidationError extends Error {
  constructor(message, code = 'CONTRACT_VIOLATION') {
    super(message);
    this.name = 'ContractValidationError';
    this.code = code;
  }
}

export function validateProjectSpec(spec) {
  if (!spec || typeof spec !== 'object') {
    throw new ContractValidationError('Project specification must be a non-null object.');
  }

  const width = spec.width ?? RENDER_CONTRACT.width;
  const height = spec.height ?? RENDER_CONTRACT.height;
  const fps = spec.fps ?? RENDER_CONTRACT.fps;
  const engine = String(spec.engine || RENDER_CONTRACT.engineFamily).toLowerCase();

  if (width !== RENDER_CONTRACT.width || height !== RENDER_CONTRACT.height) {
    throw new ContractValidationError(
      `Only 9:16 portrait 1080x1920 is permitted; got ${width}x${height}.`,
      'INVALID_DIMENSIONS'
    );
  }
  if (fps !== RENDER_CONTRACT.fps) {
    throw new ContractValidationError(
      `Only 30 FPS is permitted; got ${fps}.`,
      'INVALID_FPS'
    );
  }
  if (RENDER_CONTRACT.forbiddenEngines.some((bad) => engine.includes(bad))) {
    throw new ContractValidationError(
      `Prohibited renderer engine requested: ${engine}`,
      'PROHIBITED_ENGINE'
    );
  }

  return {
    projectId: validateProjectId(spec.projectId || 'default-short'),
    width,
    height,
    fps,
    engine,
    mode: spec.mode || 'original_engine',
    storyPath: spec.storyPath || null,
  };
}

export function validateProjectId(id) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) {
    throw new ContractValidationError(
      `Invalid projectId (must match ^[a-z0-9][a-z0-9_-]{0,63}$): ${String(id)}`,
      'INVALID_PROJECT_ID'
    );
  }
  return id;
}

export function validateFrameRange(startFrame, endFrame, maxFrames = 36000) {
  if (!Number.isInteger(startFrame) || !Number.isInteger(endFrame)) {
    throw new ContractValidationError(
      `Frame indices must be integers; got start=${startFrame}, end=${endFrame}`,
      'INVALID_FRAME_INDEX'
    );
  }
  if (startFrame < 0 || endFrame < startFrame) {
    throw new ContractValidationError(
      `Invalid frame range: startFrame=${startFrame}, endFrame=${endFrame}`,
      'INVALID_FRAME_RANGE'
    );
  }
  if (endFrame - startFrame + 1 > maxFrames) {
    throw new ContractValidationError(
      `Frame range exceeds maximum bound (${maxFrames}): ${endFrame - startFrame + 1}`,
      'FRAME_RANGE_EXCEEDED'
    );
  }
  return { startFrame, endFrame, count: endFrame - startFrame + 1 };
}

export function framesFromDurationSeconds(durationSeconds, fps = RENDER_CONTRACT.fps) {
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new ContractValidationError(
      `Duration must be a finite positive number; got ${durationSeconds}`,
      'INVALID_DURATION'
    );
  }
  return Math.round(durationSeconds * fps);
}
