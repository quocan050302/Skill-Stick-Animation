import { useEffect, useState } from 'react';
import type { ProjectRecord } from '../types';

interface RenderDialogProps {
  open: boolean;
  project: ProjectRecord;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onStartRender: (options: {
    mode: 'full' | 'bounded';
    outputPreset: 'standard' | 'native_4k';
    startFrame?: number;
    endFrame?: number;
    workers: number;
  }) => Promise<void>;
}

export function RenderDialog({
  open,
  project,
  submitting,
  error,
  onClose,
  onStartRender,
}: RenderDialogProps) {
  const [mode, setMode] = useState<'full' | 'bounded'>('full');
  const [outputPreset, setOutputPreset] = useState<'standard' | 'native_4k'>('standard');
  const [workers, setWorkers] = useState<number>(2);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const hasConflict = project.timing?.syncMode === 'conflict';
  const boundedEnd = Math.min(23, Math.max(0, project.durationFrames - 1));
  const outResLabel = outputPreset === 'native_4k' ? '2160×3840 (4K Dọc Gốc)' : '1080×1920';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasConflict) return;
    const boundedWorkers = outputPreset === 'native_4k' ? 1 : mode === 'full' ? workers : 1;
    await onStartRender(
      mode === 'full'
        ? { mode: 'full', outputPreset, workers: boundedWorkers }
        : { mode: 'bounded', outputPreset, startFrame: 0, endFrame: boundedEnd, workers: boundedWorkers }
    );
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="render-dialog-title"
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <h2 id="render-dialog-title" className="modal-title">
            Xuất Video MP4 (9:16)
          </h2>
          <button type="button" className="btn btn-subtle" onClick={onClose} disabled={submitting}>
            Đóng
          </button>
        </div>

        {(error || hasConflict) && (
          <div className="alert-banner is-danger" role="alert">
            <span>{error || project.timing.conflict?.message}</span>
          </div>
        )}

        <div className="qa-item">
          <strong style={{ color: 'var(--text)' }}>Thông số đầu ra</strong>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {outResLabel} (9:16 dọc) · 30 fps · H.264 TV-range yuv420p (+faststart) · AAC 48kHz
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Âm thanh: {project.voiceover ? 'Lời thoại + Nhạc/SFX (-6.0 dB linear gated-RMS)' : 'Nhạc & SFX nền đồng bộ (không lời thoại)'}
          </span>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="render-preset-select">
            Độ phân giải xuất
          </label>
          <select
            id="render-preset-select"
            className="select"
            value={outputPreset}
            onChange={(e) => setOutputPreset(e.target.value as 'standard' | 'native_4k')}
            data-testid="render-preset-select"
          >
            <option value="standard">1080p dọc (1080×1920 — Nhanh, khuyến nghị để thử nghiệm)</option>
            <option value="native_4k">4K dọc gốc (2160×3840 — Dựng WebGL gốc, tốn RAM & dung lượng đĩa hơn)</option>
          </select>
          {outputPreset === 'native_4k' && (
            <span style={{ fontSize: '12.5px', color: 'var(--warning)' }}>
              Lưu ý: Kết xuất 4K dọc thực tế (2160×3840) dùng 1 luồng Chromium an toàn, cần tối thiểu ~2.5 GB trống và mất nhiều thời gian hơn.
            </span>
          )}
        </div>

        <div className="field">
          <span className="field-label">Phạm vi kết xuất</span>
          <div className="template-picker" role="radiogroup" aria-label="Phạm vi kết xuất">
            <button
              type="button"
              className={`template-option ${mode === 'full' ? 'is-selected' : ''}`}
              onClick={() => setMode('full')}
              data-testid="render-mode-full"
            >
              <strong style={{ color: 'var(--text)' }}>
                Toàn bộ video ({project.durationFrames} khung · {(project.durationFrames / project.fps).toFixed(2)}s)
              </strong>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Kết xuất đầy đủ tất cả khung hình, trộn âm thanh hoàn chỉnh và chạy QA tự động.
              </span>
            </button>

            <button
              type="button"
              className={`template-option ${mode === 'bounded' ? 'is-selected' : ''}`}
              onClick={() => setMode('bounded')}
              data-testid="render-mode-bounded"
            >
              <strong style={{ color: 'var(--text)' }}>
                Đoạn kiểm tra nhanh ({boundedEnd + 1} khung · 0–{boundedEnd})
              </strong>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Dùng để kiểm tra nhanh tốc độ đóng gói MP4 và kiểm định FFprobe trong vài giây.
              </span>
            </button>
          </div>
        </div>

        {mode === 'full' && outputPreset === 'standard' && (
          <div className="field">
            <label className="field-label" htmlFor="render-workers-select">
              Số luồng Chromium song song
            </label>
            <select
              id="render-workers-select"
              className="select"
              value={workers}
              onChange={(e) => setWorkers(Number(e.target.value))}
            >
              <option value={2}>2 luồng (Cân bằng nhanh & an toàn CPU)</option>
              <option value={1}>1 luồng (Tiết kiệm RAM nhất)</option>
            </select>
          </div>
        )}

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={submitting}>
            Hủy
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || hasConflict}
            data-testid="confirm-start-render-btn"
          >
            {submitting ? 'Đang khởi tạo tác vụ...' : 'Bắt đầu kết xuất MP4'}
          </button>
        </div>
      </form>
    </div>
  );
}
