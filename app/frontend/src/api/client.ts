import type {
  HealthResponse,
  ProjectRecord,
  QaReport,
  RenderJob,
  TemplateInfo,
} from '../types';

export class ApiClientError extends Error {
  status: number;
  code: string;
  missingFiles: string[];
  retryable: boolean;

  constructor({
    status,
    code,
    message,
    missingFiles = [],
    retryable = false,
  }: {
    status: number;
    code: string;
    message: string;
    missingFiles?: string[];
    retryable?: boolean;
  }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.missingFiles = missingFiles;
    this.retryable = retryable;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = { message: text };
    }
  }
  if (!res.ok) {
    const details = (data.details as Record<string, unknown> | undefined) || undefined;
    const missing = Array.isArray(data.missingFiles)
      ? (data.missingFiles as string[])
      : Array.isArray(details?.missingFiles)
        ? (details.missingFiles as string[])
        : [];
    throw new ApiClientError({
      status: res.status,
      code: String(data.code || data.status || `HTTP_${res.status}`),
      message: String(data.message || data.error || `Lỗi máy chủ (${res.status}).`),
      missingFiles: missing,
      retryable: Boolean(data.retryable),
    });
  }
  return data as T;
}

export async function getHealth(refresh = false): Promise<HealthResponse> {
  return requestJson<HealthResponse>(`/api/health${refresh ? '?refresh=1' : ''}`);
}

export async function getTemplates(): Promise<{ originalKitReady: boolean; templates: TemplateInfo[] }> {
  return requestJson('/api/templates');
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const res = await requestJson<{ ok: boolean; projects: ProjectRecord[] }>('/api/projects');
  return res.projects;
}

export async function getProject(projectId: string): Promise<ProjectRecord> {
  const res = await requestJson<{ ok: boolean; project: ProjectRecord }>(
    `/api/projects/${encodeURIComponent(projectId)}`
  );
  return res.project;
}

export async function createProject(payload: {
  title: string;
  templateId: string;
  scriptText?: string;
}): Promise<ProjectRecord> {
  const res = await requestJson<{ ok: boolean; project: ProjectRecord }>('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.project;
}

export async function patchProject(
  projectId: string,
  patch: Record<string, unknown>
): Promise<ProjectRecord> {
  const res = await requestJson<{ ok: boolean; project: ProjectRecord }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }
  );
  return res.project;
}

export async function deleteProject(projectId: string): Promise<void> {
  await requestJson(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmProjectId: projectId }),
  });
}

export async function uploadVoiceover(projectId: string, file: File): Promise<ProjectRecord> {
  const res = await requestJson<{ ok: boolean; project: ProjectRecord }>(
    `/api/projects/${encodeURIComponent(projectId)}/assets/voiceover`,
    {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Filename': encodeURIComponent(file.name),
      },
      body: file,
    }
  );
  return res.project;
}

export async function removeVoiceover(projectId: string): Promise<ProjectRecord> {
  const res = await requestJson<{ ok: boolean; project: ProjectRecord }>(
    `/api/projects/${encodeURIComponent(projectId)}/assets/voiceover`,
    { method: 'DELETE' }
  );
  return res.project;
}

export interface PreviewFrameResult {
  objectUrl: string;
  bytes: number;
  cached: boolean;
  renderMs: number;
  renderHash: string;
}

export async function fetchPreviewFrame(
  projectId: string,
  frameIndex: number,
  renderHash: string,
  signal?: AbortSignal
): Promise<PreviewFrameResult> {
  const url = `/api/projects/${encodeURIComponent(projectId)}/preview/frame?f=${frameIndex}&h=${encodeURIComponent(renderHash)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    let data: Record<string, unknown> = {};
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      // ignore non-json
    }
    throw new ApiClientError({
      status: res.status,
      code: String(data.code || data.status || `HTTP_${res.status}`),
      message: String(data.message || data.error || 'Không thể dựng khung xem trước.'),
      missingFiles: Array.isArray(data.missingFiles) ? (data.missingFiles as string[]) : [],
      retryable: Boolean(data.retryable),
    });
  }
  const blob = await res.blob();
  return {
    objectUrl: URL.createObjectURL(blob),
    bytes: blob.size,
    cached: res.headers.get('X-Preview-Cached') === '1',
    renderMs: Number(res.headers.get('X-Render-Ms') || 0),
    renderHash: res.headers.get('X-Render-Hash') || renderHash,
  };
}

export async function startRenderJob(
  projectId: string,
  options: { mode: 'full' | 'bounded'; outputPreset?: 'standard' | 'native_4k'; startFrame?: number; endFrame?: number; workers?: number }
): Promise<RenderJob> {
  const res = await requestJson<{ ok: boolean; job: RenderJob }>(
    `/api/projects/${encodeURIComponent(projectId)}/jobs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    }
  );
  return res.job;
}

export async function listProjectJobs(projectId: string): Promise<RenderJob[]> {
  const res = await requestJson<{ ok: boolean; jobs: RenderJob[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/jobs`
  );
  return res.jobs;
}

export async function getJob(jobId: string): Promise<RenderJob> {
  const res = await requestJson<{ ok: boolean; job: RenderJob }>(
    `/api/jobs/${encodeURIComponent(jobId)}`
  );
  return res.job;
}

export async function cancelJob(jobId: string): Promise<RenderJob> {
  const res = await requestJson<{ ok: boolean; job: RenderJob }>(
    `/api/jobs/${encodeURIComponent(jobId)}/cancel`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
  );
  return res.job;
}

export async function getExportQa(projectId: string, exportId: string): Promise<QaReport> {
  const res = await requestJson<{ ok: boolean; qa: QaReport }>(
    `/api/projects/${encodeURIComponent(projectId)}/exports/${encodeURIComponent(exportId)}/qa`
  );
  return res.qa;
}

const TERMINAL_JOB_STATUSES = new Set(['completed', 'failed', 'canceled', 'interrupted']);

export function subscribeJobEvents(
  jobId: string,
  onUpdate: (job: RenderJob) => void,
  onTerminal?: (job: RenderJob) => void
): () => void {
  let closed = false;
  let pollTimer: number | null = null;
  let es: EventSource | null = null;

  const handleJob = (job: RenderJob) => {
    if (closed) return;
    onUpdate(job);
    if (TERMINAL_JOB_STATUSES.has(job.status)) {
      cleanup();
      onTerminal?.(job);
    }
  };

  const startFallbackPolling = () => {
    if (closed || pollTimer !== null) return;
    pollTimer = window.setInterval(async () => {
      try {
        const latest = await getJob(jobId);
        handleJob(latest);
      } catch {
        // retry on next tick
      }
    }, 900);
  };

  if (typeof EventSource !== 'undefined') {
    es = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/events`);
    const onMsg = (ev: MessageEvent) => {
      try {
        handleJob(JSON.parse(ev.data) as RenderJob);
      } catch {
        // ignore parse error
      }
    };
    es.addEventListener('snapshot', onMsg);
    es.addEventListener('progress', onMsg);
    es.addEventListener('completed', onMsg);
    es.addEventListener('failed', onMsg);
    es.addEventListener('canceled', onMsg);
    es.onerror = () => {
      es?.close();
      es = null;
      startFallbackPolling();
    };
  } else {
    startFallbackPolling();
  }

  function cleanup() {
    closed = true;
    if (es) {
      es.close();
      es = null;
    }
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  return cleanup;
}
