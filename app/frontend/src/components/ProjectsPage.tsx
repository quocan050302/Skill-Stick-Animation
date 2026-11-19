import { useEffect, useState } from 'react';
import type { ProjectRecord, TemplateInfo } from '../types';

interface ProjectsPageProps {
  projects: ProjectRecord[];
  templates: TemplateInfo[];
  loading: boolean;
  error: string | null;
  onOpenProject: (projectId: string) => void;
  onCreateProject: (input: { title: string; templateId: string; scriptText?: string }) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
}

export function ProjectsPage({
  projects,
  templates,
  loading,
  error,
  onOpenProject,
  onCreateProject,
  onDeleteProject,
}: ProjectsPageProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState<string>('zombie-store-10s');
  const [scriptText, setScriptText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedTpl = templates.find((t) => t.templateId === templateId) || templates[0];

  useEffect(() => {
    if (templates.length > 0 && !templates.some((t) => t.templateId === templateId && t.available)) {
      const firstAvail = templates.find((t) => t.available);
      if (firstAvail) setTemplateId(firstAvail.templateId);
    }
  }, [templates, templateId]);

  useEffect(() => {
    if (!createOpen && !deleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCreateOpen(false);
        setDeleteTarget(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [createOpen, deleteTarget]);

  const openCreateModal = () => {
    const firstAvail = templates.find((t) => t.available) || templates[0];
    setTitle('');
    if (firstAvail) {
      setTemplateId(firstAvail.templateId);
      setScriptText(firstAvail.defaultScript || '');
    }
    setFormError(null);
    setCreateOpen(true);
  };

  const handleSelectTemplate = (tpl: TemplateInfo) => {
    if (!tpl.available) return;
    setTemplateId(tpl.templateId);
    setScriptText(tpl.defaultScript || '');
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Vui lòng nhập tên dự án.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await onCreateProject({
        title: title.trim(),
        templateId,
        scriptText: scriptText.trim() || undefined,
      });
      setCreateOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể tạo dự án.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await onDeleteProject(deleteTarget.projectId);
      setDeleteTarget(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="projects-heading">
      <div className="page-header">
        <div>
          <h1 id="projects-heading" className="page-title">
            Dự án Video Ngắn (9:16)
          </h1>
          <p className="page-subtitle">
            Studio kết xuất nội bộ 1080×1920 · 30fps dựa trên engine Three.js chuẩn.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateModal}
          data-testid="new-project-btn"
        >
          + Tạo dự án mới
        </button>
      </div>

      {error && (
        <div className="alert-banner is-danger" role="alert" style={{ marginBottom: '16px' }}>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="card empty-state">
          <p>Đang tải danh sách dự án...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="card empty-state" data-testid="projects-empty-state">
          <h2>Chưa có dự án nào</h2>
          <p>
            Bắt đầu bằng cách chọn một mẫu hoạt hình 3D dựng sẵn, chỉnh góc máy, biểu cảm, bảng hiệu và xuất MP4 9:16.
          </p>
          <button type="button" className="btn btn-primary" onClick={openCreateModal}>
            Tạo dự án đầu tiên
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((p) => {
            const tplName = templates.find((t) => t.templateId === p.templateId)?.name || p.templateId;
            return (
              <article key={p.projectId} className="card project-card" data-testid={`project-card-${p.projectId}`}>
                <div className="project-card-top">
                  <div className="meta-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="pill">{tplName}</span>
                    {p.latestExport ? (
                      <span className="pill is-success">MP4 đã xuất</span>
                    ) : (
                      <span className="pill">Bản nháp</span>
                    )}
                  </div>
                  <h2 className="project-card-title">{p.title}</h2>
                  <div className="meta-row">
                    <span>{p.width}×{p.height}</span>
                    <span>·</span>
                    <span>{p.durationFrames} khung ({(p.durationFrames / p.fps).toFixed(1)}s)</span>
                    <span>·</span>
                    <span>Rev #{p.revision}</span>
                  </div>
                </div>

                <div className="project-card-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => onOpenProject(p.projectId)}
                    data-testid={`open-project-${p.projectId}`}
                  >
                    Mở Studio
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => setDeleteTarget(p)}
                    aria-label={`Xóa dự án ${p.title}`}
                    data-testid={`delete-project-${p.projectId}`}
                  >
                    Xóa
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {createOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false);
          }}
        >
          <form
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-modal-title"
            onSubmit={handleCreateSubmit}
          >
            <div className="modal-header">
              <h2 id="create-modal-title" className="modal-title">
                Tạo dự án mới
              </h2>
              <button
                type="button"
                className="btn btn-subtle"
                onClick={() => setCreateOpen(false)}
              >
                Đóng
              </button>
            </div>

            {formError && (
              <div className="alert-banner is-danger" role="alert">
                <span>{formError}</span>
              </div>
            )}

            <div className="field">
              <label className="field-label" htmlFor="new-project-title">
                Tên dự án
              </label>
              <input
                id="new-project-title"
                className="input"
                type="text"
                placeholder="Ví dụ: Giao hàng quảng trường nắng"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                autoFocus
                required
              />
            </div>

            <div className="field">
              <span className="field-label">Chọn mẫu khởi tạo 3D (9:16)</span>
              <div className="template-picker" role="radiogroup" aria-label="Mẫu khởi tạo">
                {templates.map((tpl) => {
                  const selected = tpl.templateId === selectedTpl?.templateId;
                  return (
                    <button
                      key={tpl.templateId}
                      type="button"
                      className={`template-option ${selected ? 'is-selected' : ''}`}
                      disabled={!tpl.available}
                      onClick={() => handleSelectTemplate(tpl)}
                      data-testid={`tpl-option-${tpl.templateId}`}
                    >
                      <div className="meta-row" style={{ justifyContent: 'space-between', width: '100%' }}>
                        <strong style={{ color: 'var(--text)' }}>{tpl.name}</strong>
                        <span className={`pill ${tpl.available ? 'is-success' : 'is-warning'}`}>
                          {tpl.available ? `${tpl.defaultDurationFrames} khung` : 'Cần engine gốc'}
                        </span>
                      </div>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {tpl.available ? tpl.description : tpl.blockedReason || tpl.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="new-project-script">
                Kịch bản / Lời dẫn (tùy chọn)
              </label>
              <textarea
                id="new-project-script"
                className="textarea"
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                rows={3}
                maxLength={4000}
              />
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setCreateOpen(false)}
                disabled={submitting}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                data-testid="confirm-create-project-btn"
              >
                {submitting ? 'Đang tạo...' : 'Tạo và mở Studio'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
            <div className="modal-header">
              <h2 id="delete-modal-title" className="modal-title">
                Xác nhận xóa dự án
              </h2>
            </div>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Bạn có chắc muốn xóa dự án <strong style={{ color: 'var(--text)' }}>{deleteTarget.title}</strong>? Toàn bộ
              khung hình và bản xuất MP4 của dự án sẽ bị xóa khỏi ổ đĩa.
            </p>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setDeleteTarget(null)} disabled={submitting}>
                Giữ lại
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void handleConfirmDelete()}
                disabled={submitting}
                data-testid="confirm-delete-project-btn"
              >
                {submitting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
