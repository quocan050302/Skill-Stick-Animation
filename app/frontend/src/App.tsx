import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelJob,
  createProject,
  deleteProject,
  getExportQa,
  getHealth,
  getProject,
  getTemplates,
  listProjectJobs,
  listProjects,
  patchProject,
  removeVoiceover,
  startRenderJob,
  subscribeJobEvents,
  uploadVoiceover,
} from './api/client';
import { EngineStatus } from './components/EngineStatus';
import { JobDrawer } from './components/JobDrawer';
import { ProjectHeader } from './components/ProjectHeader';
import { ProjectsPage } from './components/ProjectsPage';
import { RenderDialog } from './components/RenderDialog';
import { ShortPreview } from './components/ShortPreview';
import { ShotInspector } from './components/ShotInspector';
import type {
  HealthResponse,
  ProjectRecord,
  QaReport,
  RenderJob,
  TemplateInfo,
  TemplateShot,
} from './types';

interface RouteState {
  view: 'projects' | 'studio';
  projectId: string | null;
}

function parseRoute(pathname: string): RouteState {
  const m = pathname.match(/^\/studio\/([^/]+)$/);
  if (m) {
    return { view: 'studio', projectId: decodeURIComponent(m[1]) };
  }
  return { view: 'projects', projectId: null };
}

interface UndoSnapshot {
  title: string;
  scriptText: string;
  syncDurationToVoiceover: boolean;
  sceneOverrides: Record<string, unknown>;
  shotOverrides: unknown[];
}

function takeUndoSnapshot(p: ProjectRecord): UndoSnapshot {
  return {
    title: p.title,
    scriptText: p.scriptText,
    syncDurationToVoiceover: p.syncDurationToVoiceover,
    sceneOverrides: structuredClone(p.sceneOverrides || {}) as Record<string, unknown>,
    shotOverrides: structuredClone(p.shotOverrides || []),
  };
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'canceled', 'interrupted']);

function mergeMonotonicJob(prev: RenderJob | null, next: RenderJob): RenderJob {
  if (!prev || prev.jobId !== next.jobId) return next;
  if (TERMINAL_STATUSES.has(prev.status) && !TERMINAL_STATUSES.has(next.status)) {
    return prev;
  }
  return next;
}

export function App() {
  const [route, setRoute] = useState<RouteState>(() => parseRoute(window.location.pathname));
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [projectsLoading, setProjectsLoading] = useState<boolean>(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [activeProject, setActiveProject] = useState<ProjectRecord | null>(null);
  const [studioLoading, setStudioLoading] = useState<boolean>(false);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);

  const [frameIndex, setFrameIndex] = useState<number>(0);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [qaReport, setQaReport] = useState<QaReport | null>(null);

  const [renderDialogOpen, setRenderDialogOpen] = useState<boolean>(false);
  const [renderSubmitting, setRenderSubmitting] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const [activeJob, setActiveJob] = useState<RenderJob | null>(null);
  const [cancelingJob, setCancelingJob] = useState<boolean>(false);
  const jobUnsubRef = useRef<(() => void) | null>(null);

  const navigate = useCallback((to: string) => {
    if (window.location.pathname !== to) {
      window.history.pushState({}, '', to);
    }
    setRoute(parseRoute(to));
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const refreshBootstrap = useCallback(async (forceHealthRefresh = false) => {
    setHealthLoading(true);
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const [hRes, tRes, pRes] = await Promise.all([
        getHealth(forceHealthRefresh),
        getTemplates(),
        listProjects(),
      ]);
      setHealth(hRes);
      setTemplates(tRes.templates);
      setProjects(pRes);
    } catch (err) {
      setProjectsError(err instanceof Error ? err.message : 'Không thể kết nối máy chủ nội bộ.');
    } finally {
      setHealthLoading(false);
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshBootstrap(false);
  }, [refreshBootstrap]);

  const attachJobSubscription = useCallback(
    (job: RenderJob) => {
      jobUnsubRef.current?.();
      setActiveJob((prev) => mergeMonotonicJob(prev, job));
      if (TERMINAL_STATUSES.has(job.status)) {
        jobUnsubRef.current = null;
        return;
      }
      jobUnsubRef.current = subscribeJobEvents(
        job.jobId,
        (nextJob) => setActiveJob((prev) => mergeMonotonicJob(prev, nextJob)),
        (terminalJob) => {
          setActiveJob((prev) => mergeMonotonicJob(prev, terminalJob));
          if (terminalJob.status === 'completed') {
            void getProject(terminalJob.projectId)
              .then((fresh) => {
                setActiveProject((cur) => (cur?.projectId === fresh.projectId ? fresh : cur));
                setProjects((prev) => prev.map((p) => (p.projectId === fresh.projectId ? fresh : p)));
              })
              .catch(() => {});
          }
        }
      );
    },
    []
  );

  useEffect(() => {
    return () => {
      jobUnsubRef.current?.();
      jobUnsubRef.current = null;
    };
  }, []);

  // Load studio project whenever route enters /studio/:id
  useEffect(() => {
    if (route.view !== 'studio' || !route.projectId) {
      setActiveProject(null);
      return;
    }
    let cancelled = false;
    setStudioLoading(true);
    setStudioError(null);
    setUndoStack([]);
    setQaReport(null);

    Promise.all([getProject(route.projectId), listProjectJobs(route.projectId).catch(() => [])])
      .then(([proj, jobs]) => {
        if (cancelled) return;
        setActiveProject(proj);
        setFrameIndex((cur) => (cur >= 0 && cur < proj.durationFrames ? cur : 0));
        const tpl = templates.find((t) => t.templateId === proj.templateId);
        if (tpl?.shots?.length) {
          setSelectedShotId(tpl.shots[0].id);
        } else {
          setSelectedShotId(null);
        }
        if (jobs.length > 0) {
          attachJobSubscription(jobs[0]);
        } else {
          setActiveJob(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setStudioError(err instanceof Error ? err.message : 'Không thể mở dự án.');
        setActiveProject(null);
      })
      .finally(() => {
        if (!cancelled) setStudioLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [route.view, route.projectId, templates, attachJobSubscription]);

  // Load latest export QA automatically
  useEffect(() => {
    if (!activeProject?.latestExport) {
      setQaReport(null);
      return;
    }
    let cancelled = false;
    getExportQa(activeProject.projectId, activeProject.latestExport.exportId)
      .then((qa) => {
        if (!cancelled) setQaReport(qa);
      })
      .catch(() => {
        if (!cancelled) setQaReport(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject?.projectId, activeProject?.latestExport?.exportId]);

  const activeTemplate = useMemo(() => {
    if (!activeProject) return null;
    return templates.find((t) => t.templateId === activeProject.templateId) || null;
  }, [activeProject, templates]);

  const handleCreateProject = async (input: { title: string; templateId: string; scriptText?: string }) => {
    const created = await createProject(input);
    setProjects((prev) => [created, ...prev]);
    navigate(`/studio/${encodeURIComponent(created.projectId)}`);
  };

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId);
    setProjects((prev) => prev.filter((p) => p.projectId !== projectId));
    if (activeProject?.projectId === projectId) {
      navigate('/projects');
    }
  };

  const handlePatchProject = useCallback(
    async (patch: Record<string, unknown>, recordUndo = true) => {
      if (!activeProject) return;
      if (recordUndo) {
        const snap = takeUndoSnapshot(activeProject);
        setUndoStack((prev) => [...prev.slice(-24), snap]);
      }
      setSaving(true);
      setStudioError(null);
      try {
        const updated = await patchProject(activeProject.projectId, patch);
        setActiveProject(updated);
        setProjects((prev) => prev.map((p) => (p.projectId === updated.projectId ? updated : p)));
        if (frameIndex >= updated.durationFrames) {
          setFrameIndex(Math.max(0, updated.durationFrames - 1));
        }
      } catch (err) {
        setStudioError(err instanceof Error ? err.message : 'Không thể lưu thay đổi.');
      } finally {
        setSaving(false);
      }
    },
    [activeProject, frameIndex]
  );

  const handleUndo = useCallback(async () => {
    if (!activeProject || undoStack.length === 0) return;
    const prevSnap = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    await handlePatchProject(
      {
        title: prevSnap.title,
        scriptText: prevSnap.scriptText,
        syncDurationToVoiceover: prevSnap.syncDurationToVoiceover,
        sceneOverrides: prevSnap.sceneOverrides,
        shotOverrides: prevSnap.shotOverrides,
      },
      false
    );
  }, [activeProject, undoStack, handlePatchProject]);

  // Global keyboard shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+S flush focus
  useEffect(() => {
    if (route.view !== 'studio') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !isTextInput) {
        e.preventDefault();
        void handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route.view, handleUndo]);

  const handleUploadVoiceover = async (file: File) => {
    if (!activeProject) return;
    const updated = await uploadVoiceover(activeProject.projectId, file);
    setActiveProject(updated);
    setProjects((prev) => prev.map((p) => (p.projectId === updated.projectId ? updated : p)));
    if (frameIndex >= updated.durationFrames) {
      setFrameIndex(Math.max(0, updated.durationFrames - 1));
    }
  };

  const handleRemoveVoiceover = async () => {
    if (!activeProject) return;
    const updated = await removeVoiceover(activeProject.projectId);
    setActiveProject(updated);
    setProjects((prev) => prev.map((p) => (p.projectId === updated.projectId ? updated : p)));
  };

  const handleStartRender = async (options: {
    mode: 'full' | 'bounded';
    outputPreset?: 'standard' | 'native_4k';
    startFrame?: number;
    endFrame?: number;
    workers: number;
  }) => {
    if (!activeProject) return;
    setRenderSubmitting(true);
    setRenderError(null);
    try {
      const job = await startRenderJob(activeProject.projectId, options);
      attachJobSubscription(job);
      setRenderDialogOpen(false);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'Không thể bắt đầu tác vụ kết xuất.');
    } finally {
      setRenderSubmitting(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    setCancelingJob(true);
    try {
      const updated = await cancelJob(jobId);
      setActiveJob((prev) => mergeMonotonicJob(prev, updated));
    } finally {
      setCancelingJob(false);
    }
  };

  const hasActiveJob = Boolean(
    activeJob &&
      ['queued', 'preparing', 'frames', 'audio', 'encoding', 'qa', 'canceling', 'running'].includes(
        activeJob.status
      )
  );

  const fallbackStudioId = activeProject?.projectId || projects[0]?.projectId || null;

  return (
    <div className={`app-shell ${activeJob ? 'has-job-drawer' : ''}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-group">
            <div className="brand-mark" aria-hidden="true">
              3D
            </div>
            <span className="brand-name">Cartoon Short Studio</span>
            <span className="brand-spec">9:16 · 1080×1920 · 30fps</span>
          </div>

          <nav className="nav-tabs" aria-label="Điều hướng chính">
            <button
              type="button"
              className={`nav-tab ${route.view === 'projects' ? 'is-active' : ''}`}
              onClick={() => navigate('/projects')}
              data-testid="nav-projects"
            >
              Dự án
            </button>
            <button
              type="button"
              className={`nav-tab ${route.view === 'studio' ? 'is-active' : ''}`}
              disabled={!fallbackStudioId}
              onClick={() => {
                if (fallbackStudioId) navigate(`/studio/${encodeURIComponent(fallbackStudioId)}`);
              }}
              data-testid="nav-studio"
            >
              Studio
            </button>
          </nav>

          <EngineStatus
            health={health}
            loading={healthLoading}
            onRefresh={() => refreshBootstrap(true)}
          />
        </div>
      </header>

      <main className="main-content">
        {route.view === 'projects' && (
          <ProjectsPage
            projects={projects}
            templates={templates}
            loading={projectsLoading}
            error={projectsError}
            onOpenProject={(id) => navigate(`/studio/${encodeURIComponent(id)}`)}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
          />
        )}

        {route.view === 'studio' && (
          <section aria-label="Không gian dựng phim Studio">
            {studioError && (
              <div className="alert-banner is-danger" role="alert" style={{ marginBottom: '16px' }}>
                <span>{studioError}</span>
                <button type="button" className="btn" onClick={() => navigate('/projects')}>
                  Quay về Dự án
                </button>
              </div>
            )}

            {studioLoading || !activeProject || !activeTemplate ? (
              !studioError && (
                <div className="card empty-state">
                  <p>Đang nạp dự án Studio...</p>
                </div>
              )
            ) : (
              <>
                <ProjectHeader
                  project={activeProject}
                  saving={saving}
                  canUndo={undoStack.length > 0}
                  hasActiveJob={hasActiveJob}
                  onRename={(nextTitle) => handlePatchProject({ title: nextTitle })}
                  onUndo={handleUndo}
                  onOpenRender={() => {
                    setRenderError(null);
                    setRenderDialogOpen(true);
                  }}
                  onBackToProjects={() => navigate('/projects')}
                />

                <div className="studio-layout">
                  <ShortPreview
                    project={activeProject}
                    shots={activeTemplate.shots}
                    frameIndex={frameIndex}
                    selectedShotId={selectedShotId}
                    onChangeFrame={setFrameIndex}
                    onSelectShot={(shot: TemplateShot) => setSelectedShotId(shot.id)}
                  />

                  <ShotInspector
                    project={activeProject}
                    template={activeTemplate}
                    selectedShotId={selectedShotId}
                    currentFrame={frameIndex}
                    qaReport={qaReport}
                    onSelectShot={(shot: TemplateShot) => {
                      setSelectedShotId(shot.id);
                      setFrameIndex(
                        Math.min(shot.focusFrame, Math.max(0, activeProject.durationFrames - 1))
                      );
                    }}
                    onPatchProject={handlePatchProject}
                    onUploadVoiceover={handleUploadVoiceover}
                    onRemoveVoiceover={handleRemoveVoiceover}
                  />
                </div>

                <RenderDialog
                  open={renderDialogOpen}
                  project={activeProject}
                  submitting={renderSubmitting}
                  error={renderError}
                  onClose={() => setRenderDialogOpen(false)}
                  onStartRender={handleStartRender}
                />
              </>
            )}
          </section>
        )}
      </main>

      <JobDrawer
        job={activeJob}
        canceling={cancelingJob}
        onCancel={handleCancelJob}
        onDismiss={() => setActiveJob(null)}
        onInspectVideo={() => {
          const btn = document.querySelector('[data-testid="stage-tab-video"]') as HTMLButtonElement | null;
          btn?.click();
        }}
      />
    </div>
  );
}
