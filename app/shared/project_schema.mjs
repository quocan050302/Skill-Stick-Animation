/**
 * Validated project, starter template, capability, and timing schema for Cartoon Short Studio (SHORT-02).
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-02).
 * Strictly enforces 9:16 1080x1920 30fps and rejects arbitrary script execution or unsupported fields.
 */

import crypto from 'node:crypto';
import {
  ContractValidationError,
  framesFromDurationSeconds,
  RENDER_CONTRACT,
  validateProjectId,
} from './contract.mjs';

export const SCHEMA_VERSION = 1;

const HOODIE_ALLOWLIST = new Set(['', '#6b4ba6', '#2d7d9a', '#c94d4d', '#3e8554', '#c97b2b']);

export const TEMPLATES = Object.freeze({
  'zombie-store-10s': Object.freeze({
    templateId: 'zombie-store-10s',
    name: 'Zombie Store — Demo 10s',
    description:
      'Cửa hàng tiện lợi 3D + nhân vật hoạt hình Bloop (300 khung hình, 10.0 giây). Hỗ trợ chỉnh góc máy, ánh sáng, biểu cảm, tư thế, màu áo và biển hiệu.',
    webDirRel: 'engine/demos/zombie-10s',
    requiresOriginalKit: false,
    defaultDurationFrames: 300,
    fps: RENDER_CONTRACT.fps,
    aspectRatio: RENDER_CONTRACT.aspectRatio,
    defaultScript:
      'Bloop bước vào cửa hàng lúc nửa đêm để mua snack. Nhưng kệ hàng trống trơn! Quá hoảng hốt, Bloop va đổ chồng giỏ và bất ngờ tìm được gói Mega Chips rơi xuống đầu.',
    capabilities: Object.freeze({
      supportsShotOverrides: true,
      supportsSceneOverrides: true,
      supportsCustomSign: true,
      supportsVoiceover: true,
      editableFields: Object.freeze([
        'cameraPreset',
        'lightingPreset',
        'expression',
        'pose',
        'dofStrength',
        'signTitle',
        'aisleLabel',
        'hoodieColor',
      ]),
    }),
    shots: Object.freeze([
      { id: 'enter', title: 'Cảnh 1 · Bước vào cửa hàng', a: 0, b: 74, focusFrame: 25, defaultLight: 'storeBright' },
      { id: 'empty', title: 'Cảnh 2 · Kệ snack trống trơn', a: 75, b: 154, focusFrame: 115, defaultLight: 'storeBright' },
      { id: 'react', title: 'Cảnh 3 · Giật mình cận cảnh', a: 155, b: 219, focusFrame: 178, defaultLight: 'dramaticBlue' },
      { id: 'bump', title: 'Cảnh 4 · Va giỏ & nhận quà', a: 220, b: 299, focusFrame: 244, defaultLight: 'storePayoff' },
    ]),
    supportedOptions: Object.freeze({
      lightingPresets: Object.freeze([
        { value: 'default', label: 'Theo cảnh gốc' },
        { value: 'storeBright', label: 'Sáng cửa hàng' },
        { value: 'dramaticBlue', label: 'Xanh kịch tính' },
        { value: 'storePayoff', label: 'Ấm cao trào' },
      ]),
      sceneLightingPresets: Object.freeze([
        { value: 'auto', label: 'Tự động từng cảnh' },
        { value: 'storeBright', label: 'Sáng cửa hàng toàn bài' },
        { value: 'dramaticBlue', label: 'Xanh kịch tính toàn bài' },
        { value: 'storePayoff', label: 'Ấm cao trào toàn bài' },
      ]),
      cameraPresets: Object.freeze([
        { value: 'default', label: 'Mặc định' },
        { value: 'closeup', label: 'Cận cảnh (Close-up)' },
        { value: 'wide', label: 'Góc rộng (Wide)' },
        { value: 'dutchTilt', label: 'Nghiêng kịch tính' },
      ]),
      expressions: Object.freeze([
        { value: 'default', label: 'Theo kịch bản cảnh' },
        { value: 'grin', label: 'Cười tươi' },
        { value: 'shock', label: 'Sửng sốt' },
        { value: 'stern', label: 'Nghiêm nghị' },
        { value: 'squint', label: 'Nheo mắt' },
        { value: 'laugh', label: 'Cười lớn' },
      ]),
      poses: Object.freeze([
        { value: 'default', label: 'Theo kịch bản cảnh' },
        { value: 'wave', label: 'Vẫy tay' },
        { value: 'point', label: 'Chỉ tay' },
        { value: 'cheek', label: 'Ôm má hoảng hốt' },
        { value: 'up', label: 'Giơ tay cao' },
        { value: 'celebrate', label: 'Ăn mừng' },
        { value: 'bump', label: 'Đẩy vai' },
        { value: 'zombieWalk', label: 'Dáng đi zombie' },
      ]),
      dofStrengths: Object.freeze([
        { value: 'default', label: 'Mặc định' },
        { value: 'off', label: 'Tắt xóa phông' },
        { value: 'soft', label: 'Xóa phông nhẹ' },
        { value: 'strong', label: 'Xóa phông mạnh' },
      ]),
      hoodieColors: Object.freeze([
        { value: '', label: 'Tím mặc định' },
        { value: '#2d7d9a', label: 'Xanh ngọc' },
        { value: '#c94d4d', label: 'Đỏ san hô' },
        { value: '#3e8554', label: 'Xanh lá' },
        { value: '#c97b2b', label: 'Cam hổ phách' },
      ]),
    }),
  }),

  'plaza-courier-10s': Object.freeze({
    templateId: 'plaza-courier-10s',
    name: 'Quảng trường Giao hàng — Demo 10s',
    description:
      'Cảnh quảng trường 3D với tháp đồng hồ, đài phun nước và nhân vật giao hàng (300 khung hình, 10.0 giây). Hỗ trợ tùy biến nhân vật, màu hộp quà, bảng hiệu và từng cảnh.',
    webDirRel: 'engine/demos/plaza-courier-10s',
    requiresOriginalKit: false,
    defaultDurationFrames: 300,
    fps: RENDER_CONTRACT.fps,
    aspectRatio: RENDER_CONTRACT.aspectRatio,
    defaultScript:
      'Người đưa thư băng qua quảng trường nắng sớm với kiện hàng đặc biệt. Một cơn gió bất ngờ thổi đổ chồng hộp, nhưng kiện hàng chính đã kịp đáp gọn lên bệ vàng!',
    capabilities: Object.freeze({
      supportsShotOverrides: true,
      supportsSceneOverrides: true,
      supportsCustomSign: true,
      supportsVoiceover: true,
      editableFields: Object.freeze([
        'cameraPreset',
        'lightingPreset',
        'expression',
        'pose',
        'dofStrength',
        'signTitle',
        'characterStyle',
        'parcelColor',
      ]),
    }),
    shots: Object.freeze([
      { id: 'arrive', title: 'Cảnh 1 · Vào quảng trường', a: 0, b: 74, focusFrame: 25, defaultLight: 'morningSun' },
      { id: 'inspect', title: 'Cảnh 2 · Kiểm tra bệ giao hàng', a: 75, b: 149, focusFrame: 112, defaultLight: 'morningSun' },
      { id: 'hurdle', title: 'Cảnh 3 · Cơn gió làm đổ hộp', a: 150, b: 224, focusFrame: 185, defaultLight: 'goldenHour' },
      { id: 'deliver', title: 'Cảnh 4 · Đáp bệ vàng thành công', a: 225, b: 299, focusFrame: 270, defaultLight: 'morningSun' },
    ]),
    supportedOptions: Object.freeze({
      lightingPresets: Object.freeze([
        { value: 'default', label: 'Theo cảnh gốc' },
        { value: 'morningSun', label: 'Nắng sớm' },
        { value: 'goldenHour', label: 'Hoàng hôn vàng' },
        { value: 'nightPlaza', label: 'Quảng trường đêm' },
      ]),
      sceneLightingPresets: Object.freeze([
        { value: 'auto', label: 'Tự động từng cảnh' },
        { value: 'morningSun', label: 'Nắng sớm toàn bài' },
        { value: 'goldenHour', label: 'Hoàng hôn toàn bài' },
        { value: 'nightPlaza', label: 'Ban đêm toàn bài' },
      ]),
      cameraPresets: Object.freeze([
        { value: 'default', label: 'Mặc định' },
        { value: 'closeup', label: 'Cận cảnh (Close-up)' },
        { value: 'wide', label: 'Góc rộng (Wide)' },
        { value: 'dutchTilt', label: 'Nghiêng kịch tính' },
      ]),
      expressions: Object.freeze([
        { value: 'default', label: 'Theo kịch bản cảnh' },
        { value: 'neutral', label: 'Bình thường' },
        { value: 'grin', label: 'Cười tươi' },
        { value: 'shock', label: 'Sửng sốt' },
        { value: 'stern', label: 'Tập trung' },
        { value: 'smile', label: 'Tự tin' },
        { value: 'laugh', label: 'Cười rạng rỡ' },
      ]),
      poses: Object.freeze([
        { value: 'default', label: 'Theo kịch bản cảnh' },
        { value: 'hang', label: 'Thả tay' },
        { value: 'wave', label: 'Vẫy tay' },
        { value: 'point', label: 'Chỉ tay' },
        { value: 'up', label: 'Giơ tay cao' },
        { value: 'cheek', label: 'Ôm má' },
      ]),
      dofStrengths: Object.freeze([
        { value: 'default', label: 'Mặc định' },
        { value: 'off', label: 'Tắt xóa phông' },
        { value: 'soft', label: 'Xóa phông nhẹ' },
        { value: 'strong', label: 'Xóa phông mạnh' },
      ]),
      characterStyles: Object.freeze([
        { value: 'courierKid', label: 'Người đưa thư trẻ' },
        { value: 'townParent', label: 'Người dân áo xanh' },
        { value: 'guardCap', label: 'Điều phối viên mũ vàng' },
      ]),
      parcelColors: Object.freeze([
        { value: 'coral', label: 'Đỏ cam' },
        { value: 'teal', label: 'Xanh ngọc' },
        { value: 'gold', label: 'Vàng rực' },
      ]),
    }),
  }),

  'soldier-original': Object.freeze({
    templateId: 'soldier-original',
    name: 'Soldier — Original',
    description:
      'Dự án mẫu gốc The Soldier Who Never Left (592 khung hình, 19.73 giây). Dùng JS kit gốc cố định tại local (engine/web/), không chỉnh tham số từng cảnh từ UI.',
    webDirRel: 'engine/web',
    requiresOriginalKit: true,
    defaultDurationFrames: 592,
    fps: RENDER_CONTRACT.fps,
    aspectRatio: RENDER_CONTRACT.aspectRatio,
    defaultScript:
      'A Roman soldier stood guard at a bridge for 30 years, refusing to leave his post. Even when the empire collapsed, he stayed. People called him crazy. But when workers finally removed his helmet, they discovered a message carved inside: The bridge is not safe.',
    capabilities: Object.freeze({
      supportsShotOverrides: false,
      supportsSceneOverrides: false,
      supportsCustomSign: false,
      supportsVoiceover: true,
      editableFields: Object.freeze([]),
    }),
    shots: Object.freeze([
      { id: 'hook', title: 'Cảnh 1 · Đứng gác đầu cầu', a: 0, b: 87, focusFrame: 20, defaultLight: 'day' },
      { id: 'refuse', title: 'Cảnh 2 · Từ chối rời vị trí', a: 88, b: 149, focusFrame: 115, defaultLight: 'day' },
      { id: 'collapse', title: 'Cảnh 3 · Đế chế sụp đổ', a: 150, b: 227, focusFrame: 185, defaultLight: 'golden' },
      { id: 'crazy', title: 'Cảnh 4 · Bị chế giễu', a: 228, b: 277, focusFrame: 250, defaultLight: 'golden' },
      { id: 'workers', title: 'Cảnh 5 · Tháo mũ sắt', a: 278, b: 353, focusFrame: 335, defaultLight: 'day' },
      { id: 'inside', title: 'Cảnh 6 · Dòng chữ bên trong mũ', a: 354, b: 455, focusFrame: 425, defaultLight: 'day' },
      { id: 'shock', title: 'Cảnh 7 · Hoảng hốt', a: 456, b: 482, focusFrame: 470, defaultLight: 'day' },
      { id: 'under', title: 'Cảnh 8 · Trụ cầu mục nát', a: 483, b: 591, focusFrame: 560, defaultLight: 'day' },
    ]),
    supportedOptions: Object.freeze({}),
  }),
});

export function listTemplates(originalKitReady = false) {
  return Object.values(TEMPLATES).map((tpl) => {
    const available = !tpl.requiresOriginalKit || Boolean(originalKitReady);
    return {
      templateId: tpl.templateId,
      name: tpl.name,
      description: tpl.description,
      requiresOriginalKit: tpl.requiresOriginalKit,
      available,
      blockedReason: available
        ? null
        : 'Thiếu bộ kit gốc trên máy (engine/web/). Chạy `npm run setup:restore` sau khi đặt cartoon-short-kit.zip.',
      defaultDurationFrames: tpl.defaultDurationFrames,
      durationSeconds: Number((tpl.defaultDurationFrames / tpl.fps).toFixed(2)),
      fps: tpl.fps,
      aspectRatio: tpl.aspectRatio,
      defaultScript: tpl.defaultScript,
      capabilities: tpl.capabilities,
      shots: tpl.shots,
      supportedOptions: tpl.supportedOptions,
    };
  });
}

export function validateTemplateCapabilities(templateId, originalKitReady = false) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) {
    throw new ContractValidationError(`Template không được hỗ trợ: ${String(templateId)}`, 'INVALID_TEMPLATE');
  }
  if (tpl.requiresOriginalKit && !originalKitReady) {
    throw new ContractValidationError(
      'Thiếu bộ kit gốc trên máy (engine/web/). Không thể khởi tạo hoặc render template Soldier.',
      'INPUT_BLOCKED'
    );
  }
  return tpl;
}

function sanitizeShortText(raw, fallback, maxLen = 18) {
  if (raw === undefined || raw === null) return fallback;
  const cleaned = String(raw)
    .replace(/[\x00-\x1F\x7F<>`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
  return cleaned;
}

function defaultSceneOverrides(tpl) {
  if (tpl.templateId === 'zombie-store-10s') {
    return {
      lightingPreset: 'auto',
      signTitle: '24/7 SNACKS',
      aisleLabel: 'CRUNCH AISLE',
      hoodieColor: '',
    };
  }
  if (tpl.templateId === 'plaza-courier-10s') {
    return {
      lightingPreset: 'auto',
      signTitle: 'SUNNY PLAZA',
      characterStyle: 'courierKid',
      parcelColor: 'coral',
    };
  }
  return {};
}

function defaultShotOverrides(tpl) {
  if (!tpl.capabilities.supportsShotOverrides) return [];
  return tpl.shots.map((s) => ({
    shotId: s.id,
    cameraPreset: 'default',
    lightingPreset: 'default',
    expression: 'default',
    pose: 'default',
    dofStrength: 'default',
  }));
}

function slugifyId(title) {
  const ascii = String(title || 'short')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = crypto.randomBytes(3).toString('hex');
  const candidate = `${ascii || 'short'}-${suffix}`;
  return validateProjectId(candidate);
}

export function validateCreateProject(input, originalKitReady = false) {
  if (!input || typeof input !== 'object') {
    throw new ContractValidationError('Dữ liệu tạo dự án không hợp lệ.', 'INVALID_PROJECT');
  }
  const tpl = validateTemplateCapabilities(input.templateId || 'zombie-store-10s', originalKitReady);
  const title = sanitizeShortText(input.title, '', 80);
  if (!title) {
    throw new ContractValidationError('Vui lòng nhập tên dự án.', 'INVALID_PROJECT');
  }

  const projectId = input.projectId ? validateProjectId(input.projectId) : slugifyId(title);
  const now = new Date().toISOString();
  const project = {
    schemaVersion: SCHEMA_VERSION,
    projectId,
    title,
    templateId: tpl.templateId,
    revision: 1,
    fps: RENDER_CONTRACT.fps,
    aspectRatio: RENDER_CONTRACT.aspectRatio,
    width: RENDER_CONTRACT.width,
    height: RENDER_CONTRACT.height,
    durationFrames: tpl.defaultDurationFrames,
    scriptText: typeof input.scriptText === 'string' ? input.scriptText.slice(0, 4000) : tpl.defaultScript,
    syncDurationToVoiceover: true,
    voiceover: null,
    sceneOverrides: defaultSceneOverrides(tpl),
    shotOverrides: defaultShotOverrides(tpl),
    renderPreset: {
      format: 'jpeg',
      quality: 94,
    },
    latestExport: null,
    createdAt: now,
    updatedAt: now,
  };
  return project;
}

function validateAllowedOption(list, value, fallback, fieldName) {
  if (value === undefined) return fallback;
  const allowed = new Set((list || []).map((x) => x.value));
  if (!allowed.has(value)) {
    throw new ContractValidationError(
      `Giá trị không hợp lệ cho ${fieldName}: ${String(value)}`,
      'INVALID_PROJECT'
    );
  }
  return value;
}

export function validateProjectPatch(existing, patch) {
  if (!patch || typeof patch !== 'object') {
    throw new ContractValidationError('Dữ liệu cập nhật dự án không hợp lệ.', 'INVALID_PROJECT');
  }
  if (patch.width !== undefined && patch.width !== RENDER_CONTRACT.width) {
    throw new ContractValidationError('Chỉ hỗ trợ khổ dọc 1080x1920 (9:16).', 'INVALID_DIMENSIONS');
  }
  if (patch.height !== undefined && patch.height !== RENDER_CONTRACT.height) {
    throw new ContractValidationError('Chỉ hỗ trợ khổ dọc 1080x1920 (9:16).', 'INVALID_DIMENSIONS');
  }
  if (patch.fps !== undefined && patch.fps !== RENDER_CONTRACT.fps) {
    throw new ContractValidationError('Chỉ hỗ trợ tốc độ 30 FPS.', 'INVALID_FPS');
  }
  if (patch.code !== undefined || patch.eval !== undefined || patch.scriptCode !== undefined) {
    throw new ContractValidationError('Không cho phép chạy hoặc lưu mã script tùy ý từ UI.', 'SECURITY_VIOLATION');
  }
  if (
    patch.expectedRevision !== undefined &&
    Number(patch.expectedRevision) !== existing.revision
  ) {
    throw new ContractValidationError(
      `Xung đột phiên bản: máy chủ đang ở revision ${existing.revision}, nhưng yêu cầu gửi ${patch.expectedRevision}.`,
      'REVISION_CONFLICT'
    );
  }

  const tpl = TEMPLATES[existing.templateId];
  if (!tpl) {
    throw new ContractValidationError(`Template không tồn tại: ${existing.templateId}`, 'INVALID_TEMPLATE');
  }

  const next = structuredClone(existing);
  if (patch.title !== undefined) {
    const title = sanitizeShortText(patch.title, '', 80);
    if (!title) {
      throw new ContractValidationError('Tên dự án không được để trống.', 'INVALID_PROJECT');
    }
    next.title = title;
  }
  if (patch.scriptText !== undefined) {
    if (typeof patch.scriptText !== 'string' || patch.scriptText.length > 4000) {
      throw new ContractValidationError('Kịch bản lời thoại tối đa 4000 ký tự.', 'INVALID_PROJECT');
    }
    next.scriptText = patch.scriptText;
  }
  if (patch.syncDurationToVoiceover !== undefined) {
    next.syncDurationToVoiceover = Boolean(patch.syncDurationToVoiceover);
  }

  if (patch.sceneOverrides !== undefined) {
    if (!tpl.capabilities.supportsSceneOverrides) {
      throw new ContractValidationError(
        'Template gốc Soldier không hỗ trợ chỉnh tham số cảnh từ UI.',
        'UNSUPPORTED_TEMPLATE_EDIT'
      );
    }
    const opts = tpl.supportedOptions;
    const sc = patch.sceneOverrides || {};
    const cur = { ...(existing.sceneOverrides || {}) };
    cur.lightingPreset = validateAllowedOption(
      opts.sceneLightingPresets,
      sc.lightingPreset,
      cur.lightingPreset || 'auto',
      'sceneOverrides.lightingPreset'
    );
    if (sc.signTitle !== undefined) {
      cur.signTitle = sanitizeShortText(
        sc.signTitle,
        tpl.templateId === 'zombie-store-10s' ? '24/7 SNACKS' : 'SUNNY PLAZA',
        18
      );
    }
    if (tpl.templateId === 'zombie-store-10s') {
      if (sc.aisleLabel !== undefined) {
        cur.aisleLabel = sanitizeShortText(sc.aisleLabel, 'CRUNCH AISLE', 18);
      }
      if (sc.hoodieColor !== undefined) {
        if (!HOODIE_ALLOWLIST.has(sc.hoodieColor)) {
          throw new ContractValidationError('Màu áo không nằm trong danh sách hỗ trợ.', 'INVALID_PROJECT');
        }
        cur.hoodieColor = sc.hoodieColor;
      }
    }
    if (tpl.templateId === 'plaza-courier-10s') {
      cur.characterStyle = validateAllowedOption(
        opts.characterStyles,
        sc.characterStyle,
        cur.characterStyle || 'courierKid',
        'sceneOverrides.characterStyle'
      );
      cur.parcelColor = validateAllowedOption(
        opts.parcelColors,
        sc.parcelColor,
        cur.parcelColor || 'coral',
        'sceneOverrides.parcelColor'
      );
    }
    next.sceneOverrides = cur;
  }

  if (patch.shotOverrides !== undefined) {
    if (!tpl.capabilities.supportsShotOverrides) {
      throw new ContractValidationError(
        'Template gốc Soldier không hỗ trợ chỉnh từng cảnh từ UI.',
        'UNSUPPORTED_TEMPLATE_EDIT'
      );
    }
    if (!Array.isArray(patch.shotOverrides)) {
      throw new ContractValidationError('shotOverrides phải là mảng.', 'INVALID_PROJECT');
    }
    const opts = tpl.supportedOptions;
    const byId = new Map((existing.shotOverrides || []).map((s) => [s.shotId, s]));
    for (const item of patch.shotOverrides) {
      if (!item || typeof item !== 'object' || !tpl.shots.some((s) => s.id === item.shotId)) {
        throw new ContractValidationError(`Cảnh không hợp lệ: ${item?.shotId}`, 'INVALID_PROJECT');
      }
      const prevShot = byId.get(item.shotId) || {
        shotId: item.shotId,
        cameraPreset: 'default',
        lightingPreset: 'default',
        expression: 'default',
        pose: 'default',
        dofStrength: 'default',
      };
      byId.set(item.shotId, {
        shotId: item.shotId,
        cameraPreset: validateAllowedOption(opts.cameraPresets, item.cameraPreset, prevShot.cameraPreset, 'cameraPreset'),
        lightingPreset: validateAllowedOption(opts.lightingPresets, item.lightingPreset, prevShot.lightingPreset, 'lightingPreset'),
        expression: validateAllowedOption(opts.expressions, item.expression, prevShot.expression, 'expression'),
        pose: validateAllowedOption(opts.poses, item.pose, prevShot.pose, 'pose'),
        dofStrength: validateAllowedOption(opts.dofStrengths, item.dofStrength, prevShot.dofStrength, 'dofStrength'),
      });
    }
    next.shotOverrides = tpl.shots.map((s) => byId.get(s.id));
  }

  const timing = deriveFrameCount(next);
  next.durationFrames = timing.durationFrames;
  next.revision = existing.revision + 1;
  next.updatedAt = new Date().toISOString();
  return next;
}

export function deriveFrameCount(project) {
  const tpl = TEMPLATES[project.templateId];
  if (!tpl) {
    throw new ContractValidationError(`Unknown templateId: ${project.templateId}`, 'INVALID_TEMPLATE');
  }
  const maxFrames = tpl.defaultDurationFrames;
  const vo = project.voiceover;
  if (!vo || typeof vo.durationSeconds !== 'number') {
    return {
      durationFrames: maxFrames,
      durationSeconds: Number((maxFrames / RENDER_CONTRACT.fps).toFixed(3)),
      voiceoverFrames: null,
      syncMode: 'template_default',
      conflict: null,
    };
  }

  const voFrames = framesFromDurationSeconds(vo.durationSeconds, RENDER_CONTRACT.fps);
  if (project.syncDurationToVoiceover !== false) {
    if (voFrames > maxFrames) {
      return {
        durationFrames: maxFrames,
        durationSeconds: Number((maxFrames / RENDER_CONTRACT.fps).toFixed(3)),
        voiceoverFrames: voFrames,
        syncMode: 'conflict',
        conflict: {
          code: 'TIMING_DURATION_MISMATCH',
          message: `Lời thoại dài ${vo.durationSeconds.toFixed(2)}s (${voFrames} khung hình), vượt quá thời lượng cảnh tối đa của template (${maxFrames} khung hình / ${(maxFrames / 30).toFixed(2)}s). Không tự ý kéo giãn khung hình — hãy thay lời thoại ngắn hơn hoặc tắt khớp tự động.`,
        },
      };
    }
    return {
      durationFrames: voFrames,
      durationSeconds: Number((voFrames / RENDER_CONTRACT.fps).toFixed(3)),
      voiceoverFrames: voFrames,
      syncMode: 'matched_voiceover',
      conflict: null,
    };
  }

  return {
    durationFrames: maxFrames,
    durationSeconds: Number((maxFrames / RENDER_CONTRACT.fps).toFixed(3)),
    voiceoverFrames: voFrames,
    syncMode: 'template_fixed_with_voiceover',
    conflict:
      voFrames > maxFrames
        ? {
            code: 'TIMING_DURATION_MISMATCH',
            message: `Lời thoại (${vo.durationSeconds.toFixed(2)}s) dài hơn video (${(maxFrames / 30).toFixed(2)}s) và sẽ bị cắt phần dư nếu xuất.`,
          }
        : null,
  };
}

export function buildEngineOverrides(project) {
  const tpl = TEMPLATES[project.templateId];
  if (!tpl || !tpl.capabilities.supportsShotOverrides) {
    return null;
  }
  const shotsObj = {};
  for (const s of project.shotOverrides || []) {
    shotsObj[s.shotId] = {
      cameraPreset: s.cameraPreset || 'default',
      lightingPreset: s.lightingPreset || 'default',
      expression: s.expression || 'default',
      pose: s.pose || 'default',
      dofStrength: s.dofStrength || 'default',
    };
  }
  return {
    scene: { ...(project.sceneOverrides || {}) },
    shots: shotsObj,
  };
}

export function computeRenderHash(project) {
  const payload = {
    templateId: project.templateId,
    durationFrames: project.durationFrames,
    sceneOverrides: project.sceneOverrides || {},
    shotOverrides: project.shotOverrides || [],
    voiceoverSha256: project.voiceover?.sha256 || null,
    renderPreset: project.renderPreset || { format: 'jpeg', quality: 94 },
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}
