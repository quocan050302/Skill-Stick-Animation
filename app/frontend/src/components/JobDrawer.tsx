import { useEffect, useState } from 'react';
import type { RenderJob } from '../types';

interface JobDrawerProps {
  job: RenderJob | null;
  canceling: boolean;
  onCancel: (jobId: string) => Promise<void>;
  onDismiss: () => void;
  onInspectVideo: () => void;
}

const ACTIVE_SET = new Set(['queued', 'preparing', 'frames', 'audio', 'encoding', 'qa', 'canceling', 'running']);

export function JobDrawer({ job, canceling, onCancel, onDismiss, onInspectVideo }: JobDrawerProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!job) return;
    if (job.status === 'failed' || job.status === 'frames' || job.status === 'preparing') {
      setExpanded(true);
    } else if (job.status === 'completed' || job.status === 'canceled') {
      setExpanded(false);
    }
  }, [job?.jobId, job?.status]);

  if (!job) return null;

  const isActive = ACTIVE_SET.has(job.status);
  const pillClass =
    job.status === 'completed'
      ? 'is-success'
      : job.status === 'failed'
        ? 'is-danger'
        : job.status === 'canceled' || job.status === 'interrupted'
          ? 'is-warning'
          : '';

  return (
    <section
      className="job-drawer"
      aria-label="Trạng thái kết xuất video"
      aria-live="polite"
      data-testid="job-drawer"
    >
      <div className="job-drawer-inner">
        <div className="job-drawer-summary">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', minWidth: 0 }}>
            <span className={`pill ${pillClass}`} data-testid="job-status-badge">
              {job.status.toUpperCase()}
            </span>
            <strong style={{ fontSize: '14px' }}>{job.projectTitle}</strong>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {job.message}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="frame-counter" data-testid="job-progress-text">
              {job.completedFrames}/{job.totalFrames} khung · {job.progress}%
              {job.etaSeconds !== null && isActive ? ` · ~${job.etaSeconds}s` : ''}
            </span>

            {isActive && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void onCancel(job.jobId)}
                disabled={canceling || job.status === 'canceling'}
                data-testid="cancel-job-btn"
              >
                {job.status === 'canceling' ? 'Đang hủy...' : 'Hủy tác vụ'}
              </button>
            )}

            {job.status === 'completed' && job.exportSummary && (
              <>
                <button type="button" className="btn btn-primary" onClick={onInspectVideo}>
                  Xem & tải MP4
                </button>
                <a
                  className="btn"
                  href={`${job.exportSummary.videoUrl}?download=1`}
                  download
                >
                  Tải MP4
                </a>
              </>
            )}

            <button
              type="button"
              className="btn"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
            >
              {expanded ? 'Thu gọn' : 'Chi tiết'}
            </button>

            {!isActive && (
              <button type="button" className="btn btn-subtle" onClick={onDismiss} aria-label="Đóng thanh tiến trình">
                Đóng
              </button>
            )}
          </div>
        </div>

        <div className="job-progress-bar" role="progressbar" aria-valuenow={job.progress} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="job-progress-fill"
            style={{
              width: `${Math.max(0, Math.min(100, job.progress))}%`,
              background:
                job.status === 'failed'
                  ? 'var(--danger)'
                  : job.status === 'completed'
                    ? 'var(--success)'
                    : 'var(--accent)',
            }}
          />
        </div>

        {expanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {job.error && (
              <div className="alert-banner is-danger" role="alert">
                <span>{job.error.message}</span>
              </div>
            )}

            {job.qaSummary && (
              <div className="qa-grid">
                {job.qaSummary.gates.map((g) => (
                  <div className="qa-item" key={g.id}>
                    <div className="meta-row" style={{ justifyContent: 'space-between' }}>
                      <strong style={{ color: 'var(--text)' }}>{g.label}</strong>
                      <span
                        className={`pill ${
                          g.status === 'PASS'
                            ? 'is-success'
                            : g.status === 'FAIL'
                              ? 'is-danger'
                              : 'is-warning'
                        }`}
                      >
                        {g.status}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{g.detail}</span>
                  </div>
                ))}
              </div>
            )}

            {job.logs && job.logs.length > 0 && (
              <pre className="job-logs">{job.logs.slice(-6).join('\n')}</pre>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
