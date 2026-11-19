/**
 * Shared Engine API contract constants & validators for SHORT-01 / SHORT-02 / SHORT-03A.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01, extended for native 4K in SHORT-03A).
 * Enforces strict 9:16 portrait aspect ratio & 30fps Three.js pipeline; supports allowlisted
 * 1080x1920 (`standard`, default) and native 2160x3840 (`native_4k`) vertical presets.
 */

export const OUTPUT_PRESETS = Object.freeze({
  standard: Object.freeze({
    id: 'standard',
    label: '1080×1920 (Tiêu chuẩn 9:16)',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    fps: 30,
  }),
  native_4k: Object.freeze({
    id: 'native_4k',
    label: '2160×3840 (4K Dọc Gốc 9:16)',
    width: 2160,
    height: 3840,
    aspectRatio: '9:16',
    fps: 30,
  }),
});

export const RENDER_CONTRACT = Object.freeze({
  width: 1080,
  height: 1920,
  aspectRatio: '9:16',
  fps: 30,
  videoCodec: 'h264',
  pixelFormat: 'yuv420p',
  audioCodec: 'aac',
  engineFamily: 'threejs-2d-char-3d-world',
  allowedPresets: Object.freeze(['standard', 'native_4k']),
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

export function resolveOutputPreset(input) {
  if (!input || input === 'standard') {
    return OUTPUT_PRESETS.standard;
  }
  if (typeof input === 'string') {
    const p = OUTPUT_PRESETS[input];
    if (!p) {
      throw new ContractValidationError(`Unsupported output preset: ${input}`, 'INVALID_OUTPUT_PRESET');
    }
    return p;
  }
  const presetKey = input.outputPreset || null;
  if (presetKey) {
    const preset = OUTPUT_PRESETS[presetKey];
    if (!preset) {
      throw new ContractValidationError(`Unsupported outputPreset: ${presetKey}`, 'INVALID_OUTPUT_PRESET');
    }
    if (
      (input.width !== undefined && input.width !== preset.width) ||
      (input.height !== undefined && input.height !== preset.height)
    ) {
      throw new ContractValidationError(
        `Dimensions ${input.width}x${input.height} do not match preset "${presetKey}" (${preset.width}x${preset.height}).`,
        'INVALID_DIMENSIONS'
      );
    }
    return preset;
  }

  const w = input.width ?? RENDER_CONTRACT.width;
  const h = input.height ?? RENDER_CONTRACT.height;
  for (const preset of Object.values(OUTPUT_PRESETS)) {
    if (w === preset.width && h === preset.height) {
      return preset;
    }
  }
  throw new ContractValidationError(
    `Only 9:16 portrait 1080x1920 or native 2160x3840 is permitted; got ${w}x${h}.`,
    'INVALID_DIMENSIONS'
  );
}

export function validateProjectSpec(spec) {
  if (!spec || typeof spec !== 'object') {
    throw new ContractValidationError('Project specification must be a non-null object.');
  }

  const preset = resolveOutputPreset(spec);
  const fps = spec.fps ?? RENDER_CONTRACT.fps;
  const engine = String(spec.engine || RENDER_CONTRACT.engineFamily).toLowerCase();

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
    outputPreset: preset.id,
    width: preset.width,
    height: preset.height,
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
