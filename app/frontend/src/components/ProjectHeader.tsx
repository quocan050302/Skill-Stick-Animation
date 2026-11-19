import { useEffect, useState } from 'react';
import type { ProjectRecord } from '../types';

interface ProjectHeaderProps {
  project: ProjectRecord;
  saving: boolean;
  canUndo: boolean;
  hasActiveJob: boolean;
  onRename: (nextTitle: string) => Promise<void>;
  onUndo: () => Promise<void>;
  onOpenRender: () => void;
  onBackToProjects: () => void;
}

export function ProjectHeader({
  project,
  saving,
  canUndo,
  hasActiveJob,
  onRename,
  onUndo,
  onOpenRender,
  onBackToProjects,
}: ProjectHeaderProps) {
  const [titleDraft, setTitleDraft] = useState(project.title);

  useEffect(() => {
    setTitleDraft(project.title);
  }, [project.title]);

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleDraft(project.title);
      return;
    }
    if (trimmed !== project.title) {
      void onRename(trimmed);
    }
  };

  const hasTimingConflict = project.timing?.syncMode === 'conflict';

  return (
    <div className="card studio-header">
      <div className="studio-title-block">
        <div className="studio-title-row">
          <button
            type="button"
            className="btn"
            onClick={onBackToProjects}
            aria-label="Quay về danh sách dự án"
          >
            ← Dự án
          </button>
          <label className="sr-only" htmlFor="studio-project-title" style={{ position: 'absolute', left: '-9999px' }}>
            Tên dự án
          </label>
          <input
            id="studio-project-title"
            className="title-input"
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            maxLength={80}
          />
        </div>
        <div className="meta-row">
          <span className="pill">{project.width}×{project.height} · {project.aspectRatio}</span>
          <span className="pill">{project.fps} fps</span>
          <span className="pill">
            {project.durationFrames} khung ({(project.durationFrames / project.fps).toFixed(2)}s)
          </span>
          <span className="pill">Rev #{project.revision}</span>
          <span className="save-indicator" aria-live="polite">
            {saving ? 'Đang lưu...' : 'Đã lưu tự động'}
          </span>
        </div>
      </div>

      <div className="studio-actions">
        <button
          type="button"
          className="btn"
          onClick={() => void onUndo()}
          disabled={!canUndo || saving}
          title="Hoàn tác thay đổi gần nhất (Ctrl+Z)"
          data-testid="undo-btn"
        >
          Hoàn tác
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onOpenRender}
          disabled={hasActiveJob || hasTimingConflict}
          title={hasTimingConflict ? project.timing.conflict?.message : undefined}
          data-testid="open-render-dialog-btn"
        >
          {hasActiveJob ? 'Đang kết xuất...' : 'Xuất MP4'}
        </button>
      </div>
    </div>
  );
}
