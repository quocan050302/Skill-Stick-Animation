import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { HealthResponse } from '../types';

interface EngineStatusProps {
  health: HealthResponse | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
}

export function EngineStatus({ health, loading, onRefresh }: EngineStatusProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const allReady = Boolean(health?.ok && health?.allToolsReady);
  const originalReady = Boolean(health?.originalKitReady);

  return (
    <>
      <button
        type="button"
        className="status-pill-btn"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="engine-status-btn"
      >
        <span className={`status-dot ${allReady ? '' : 'is-warn'}`} aria-hidden="true" />
        <span>{loading ? 'Đang kiểm tra...' : originalReady ? 'Engine sẵn sàng' : 'Chưa đủ kit gốc'}</span>
      </button>

      {open &&
        createPortal(
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="engine-modal-title">
              <div className="modal-header">
                <h2 id="engine-modal-title" className="modal-title">
                  Trạng thái Engine & Công cụ nội bộ
                </h2>
                <button
                  type="button"
                  className="btn btn-subtle"
                  onClick={() => setOpen(false)}
                  aria-label="Đóng hộp thoại trạng thái"
                >
                  Đóng
                </button>
              </div>

              {!originalReady && (
                <div className="alert-banner is-warning">
                  <div>
                    <strong>Thiếu tệp Engine Soldier gốc (INPUT_BLOCKED):</strong>{' '}
                    {health?.originalEngine.missingFiles?.join(', ') || 'engine/web/*'}. Các mẫu nội bộ
                    (Zombie Store, Plaza Courier) vẫn hoạt động bình thường; để mở khóa mẫu Soldier gốc, chạy{' '}
                    <code>npm run setup:restore</code>.
                  </div>
                </div>
              )}

              <div className="qa-grid">
                {health?.tools &&
                  Object.entries(health.tools).map(([key, info]) => (
                    <div className="qa-item" key={key}>
                      <div className="meta-row" style={{ justifyContent: 'space-between' }}>
                        <strong style={{ color: 'var(--text)' }}>{key}</strong>
                        <span className={`pill ${info.ok ? 'is-success' : 'is-warning'}`}>
                          {info.ok ? 'OK' : 'Thiếu'}
                        </span>
                      </div>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        {info.version || info.detail || 'Đã sẵn sàng'}
                      </span>
                    </div>
                  ))}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn"
                  onClick={() => void onRefresh()}
                  disabled={loading}
                >
                  {loading ? 'Đang quét...' : 'Kiểm tra lại'}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>
                  Xong
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
