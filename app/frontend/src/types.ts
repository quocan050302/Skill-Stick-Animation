export interface TemplateShot {
  id: string;
  title: string;
  a: number;
  b: number;
  focusFrame: number;
  defaultLight: string;
}

export interface OptionChoice {
  value: string;
  label: string;
}

export interface TemplateInfo {
  templateId: string;
  name: string;
  description: string;
  requiresOriginalKit: boolean;
  available: boolean;
  blockedReason: string | null;
  defaultDurationFrames: number;
  fps: number;
  aspectRatio: string;
  defaultScript: string;
  capabilities: {
    supportsShotOverrides: boolean;
    supportsSceneOverrides: boolean;
    supportsCustomSign: boolean;
    supportsVoiceover: boolean;
    editableFields: string[];
  };
  shots: TemplateShot[];
  supportedOptions: Record<string, OptionChoice[]>;
}

export interface VoiceoverMeta {
  storedFilename: string;
  originalFilename: string;
  relPath: string;
  mimeType: string | null;
  bytes: number;
  sha256: string;
  durationSeconds: number;
  codec: string | null;
  sampleRate: number | null;
  channels: number | null;
  importedAtUtc: string;
}

export interface TimingInfo {
  durationFrames: number;
  durationSeconds: number;
  voiceoverFrames: number | null;
  syncMode: 'template_default' | 'matched_voiceover' | 'template_fixed_with_voiceover' | 'conflict';
  conflict: {
    code: string;
    message: string;
  } | null;
}

export interface SceneOverrides {
  lightingPreset?: string;
  signTitle?: string;
  aisleLabel?: string;
  hoodieColor?: string;
  characterStyle?: string;
  parcelColor?: string;
  visualFoundation?: 'baseline' | 'enhanced';
}

export interface ShotOverride {
  shotId: string;
  cameraPreset: string;
  lightingPreset: string;
  expression: string;
  pose: string;
  dofStrength: string;
}

export interface ExportSummary {
  exportId: string;
  jobId: string;
  mode: 'full' | 'bounded';
  outputPreset?: 'standard' | 'native_4k';
  width?: number;
  height?: number;
  frameCount: number;
  startFrame: number;
  endFrame: number;
  durationSeconds: number;
  bytes: number;
  renderHash: string;
  revision: number;
  hasVoiceover: boolean;
  qaOverallStatus: 'PASS' | 'FAIL';
  createdAtUtc: string;
  videoUrl: string;
  qaUrl: string;
}

export interface ProjectRecord {
  schemaVersion: number;
  projectId: string;
  title: string;
  templateId: string;
  revision: number;
  fps: number;
  aspectRatio: string;
  width: number;
  height: number;
  durationFrames: number;
  scriptText: string;
  syncDurationToVoiceover: boolean;
  voiceover: VoiceoverMeta | null;
  sceneOverrides: SceneOverrides;
  shotOverrides: ShotOverride[];
  renderPreset: {
    format: 'jpeg' | 'png';
    quality: number;
  };
  latestExport: ExportSummary | null;
  createdAt: string;
  updatedAt: string;
  renderHash: string;
  timing: TimingInfo;
}

export interface QaGate {
  id: string;
  label: string;
  status: 'PASS' | 'FAIL' | 'UNVERIFIED' | 'NOT_APPLICABLE';
  detail: string;
}

export interface QaReport {
  checkedAtUtc: string;
  overallStatus: 'PASS' | 'FAIL';
  gates: QaGate[];
}

export interface RenderJob {
  jobId: string;
  exportId: string;
  projectId: string;
  projectTitle: string;
  templateId: string;
  renderHash: string;
  mode: 'full' | 'bounded';
  startFrame: number;
  endFrame: number;
  totalFrames: number;
  completedFrames: number;
  workers: number;
  format: string;
  quality: number;
  status: 'queued' | 'preparing' | 'frames' | 'audio' | 'encoding' | 'qa' | 'canceling' | 'completed' | 'failed' | 'canceled' | 'interrupted';
  stage: string;
  progress: number;
  etaSeconds: number | null;
  message: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  startedAtUtc: string | null;
  finishedAtUtc: string | null;
  exportSummary: ExportSummary | null;
  qaSummary: { overallStatus: string; gates: QaGate[]; checkedAtUtc: string } | null;
  error: { code: string; message: string; retryable: boolean } | null;
  logs: string[];
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  host: string;
  port: number;
  originalKitReady: boolean;
  originalEngine: {
    ready: boolean;
    missingFiles: string[];
  };
  tools: Record<string, { ok: boolean; detail?: string; version?: string }>;
  allToolsReady: boolean;
  templatesCount: number;
}
