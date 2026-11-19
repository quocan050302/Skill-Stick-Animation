import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError, fetchPreviewFrame } from '../api/client';
import type { ProjectRecord, TemplateShot } from '../types';

interface ShortPreviewProps {
  project: ProjectRecord;
  shots: TemplateShot[];
  frameIndex: number;
  selectedShotId: string | null;
  onChangeFrame: (frameIndex: number) => void;
  onSelectShot: (shot: TemplateShot) => void;
}

export function ShortPreview({
  project,
  shots,
  frameIndex,
  selectedShotId,
  onChangeFrame,
  onSelectShot,
}: ShortPreviewProps) {
  const [stageMode, setStageMode] = useState<'frame' | 'video'>('frame');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingFrame, setLoadingFrame] = useState<boolean>(false);
  const [renderMeta, setRenderMeta] = useState<{ bytes: number; cached: boolean; renderMs: number } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [playingDraft, setPlayingDraft] = useState<boolean>(false);
  const [refreshNonce, setRefreshNonce] = useState<number>(0);

  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const playTimerRef = useRef<number | null>(null);

  const loadFrame = useCallback(
    async (targetFrame: number) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoadingFrame(true);
      setPreviewError(null);
      try {
        const res = await fetchPreviewFrame(project.projectId, targetFrame, project.renderHash, ctrl.signal);
        if (ctrl.signal.aborted) {
          URL.revokeObjectURL(res.objectUrl);
          return;
        }
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        objectUrlRef.current = res.objectUrl;
        setImageUrl(res.objectUrl);
        setRenderMeta({ bytes: res.bytes, cached: res.cached, renderMs: res.renderMs });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (err instanceof ApiClientError && err.code === 'PREVIEW_SUPERSEDED') return;
        setPreviewError(err instanceof Error ? err.message : 'Lỗi dựng khung xem trước.');
        setPlayingDraft(false);
      } finally {
        if (!ctrl.signal.aborted) {
          setLoadingFrame(false);
        }
      }
    },
    [project.projectId, project.renderHash]
  );

  // Debounce burst timeline scrubbing cleanly while reacting promptly
  useEffect(() => {
    if (stageMode !== 'frame') return;
    const timer = window.setTimeout(() => {
      void loadFrame(frameIndex);
    }, 55);
    return () => window.clearTimeout(timer);
  }, [frameIndex, project.renderHash, project.projectId, stageMode, refreshNonce, loadFrame]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  // Draft playback advances in steady steps when prior frame settles
  useEffect(() => {
    if (!playingDraft || stageMode !== 'frame') {
      if (playTimerRef.current !== null) {
        window.clearTimeout(playTimerRef.current);
        playTimerRef.current = null;
      }
      return;
    }
    if (loadingFrame) return;
    playTimerRef.current = window.setTimeout(() => {
      const next = frameIndex + 6 >= project.durationFrames ? 0 : frameIndex + 6;
      onChangeFrame(next);
    }, 180);
    return () => {
      if (playTimerRef.current !== null) {
        window.clearTimeout(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [playingDraft, stageMode, loadingFrame, frameIndex, project.durationFrames, onChangeFrame]);

  // If latestExport vanishes, revert stageMode to frame
  useEffect(() => {
    if (!project.latestExport && stageMode === 'video') {
      setStageMode('frame');
    }
  }, [project.latestExport, stageMode]);

  const timeSec = (frameIndex / project.fps).toFixed(2);
  const videoSrc = project.latestExport
    ? `${project.latestExport.videoUrl}?h=${encodeURIComponent(project.latestExport.exportId)}`
    : null;

  return (
    <aside className="card preview-panel" aria-label="Khung xem trước video 9:16">
      {project.latestExport && (
        <div className="stage-mode-switch" role="tablist" aria-label="Chế độ xem trước">
          <button
            type="button"
            role="tab"
            aria-selected={stageMode === 'frame'}
            className={`stage-mode-btn ${stageMode === 'frame' ? 'is-active' : ''}`}
            onClick={() => setStageMode('frame')}
            data-testid="stage-tab-frame"
          >
            Khung dựng 3D
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={stageMode === 'video'}
            className={`stage-mode-btn ${stageMode === 'video' ? 'is-active' : ''}`}
            onClick={() => {
              setPlayingDraft(false);
              setStageMode('video');
            }}
            data-testid="stage-tab-video"
          >
            Video MP4 đã xuất
          </button>
        </div>
      )}

      <div className="stage-viewport">
        {stageMode === 'video' && videoSrc ? (
          <video
            key={videoSrc}
            className="stage-video"
            controls
            playsInline
            preload="metadata"
            src={videoSrc}
            data-testid="exported-mp4-player"
          />
        ) : imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={`Khung hình ${frameIndex} của ${project.title}`}
              className={`stage-img ${loadingFrame ? 'is-loading' : ''}`}
              data-testid="preview-frame-img"
            />
            {loadingFrame && (
              <div className="stage-overlay-pill" aria-live="polite">
                Đang dựng khung {frameIndex}...
              </div>
            )}
          </>
        ) : (
          <div className="stage-placeholder" aria-live="polite">
            {loadingFrame ? 'Đang khởi động trình dựng Three.js 9:16...' : 'Chưa có khung hình xem trước.'}
          </div>
        )}
      </div>

      {previewError && (
        <div className="alert-banner is-danger" role="alert">
          <span>{previewError}</span>
          <button type="button" className="btn" onClick={() => setRefreshNonce((n) => n + 1)}>
            Thử lại
          </button>
        </div>
      )}

      {stageMode === 'frame' && (
        <div className="scrub-controls">
          <div className="scrub-top-row">
            <span className="frame-counter" data-testid="frame-counter">
              Khung {frameIndex} / {Math.max(0, project.durationFrames - 1)} · {timeSec}s
            </span>
            <span className="frame-counter" style={{ fontSize: '12px' }}>
              {renderMeta
                ? renderMeta.cached
                  ? 'Bộ nhớ đệm'
                  : `${renderMeta.renderMs}ms · ${(renderMeta.bytes / 1024).toFixed(0)} KB`
                : '9:16 1080×1920'}
            </span>
          </div>

          <div className="range-wrap">
            <label htmlFor="timeline-scrubber" style={{ position: 'absolute', left: '-9999px' }}>
              Thanh tua khung hình
            </label>
            <input
              id="timeline-scrubber"
              className="timeline-slider"
              type="range"
              min={0}
              max={Math.max(0, project.durationFrames - 1)}
              step={1}
              value={frameIndex}
              onChange={(e) => {
                setPlayingDraft(false);
                onChangeFrame(Number(e.target.value));
              }}
              data-testid="timeline-scrubber"
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              style={{ flex: 1 }}
              onClick={() => setPlayingDraft((p) => !p)}
            >
              {playingDraft ? 'Tạm dừng' : 'Phát nháp'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setRefreshNonce((n) => n + 1)}
              title="Dựng lại khung hiện tại"
            >
              Làm mới
            </button>
          </div>

          {shots.length > 0 && (
            <div className="shot-markers-row" aria-label="Điểm đánh dấu cảnh">
              {shots.map((shot, idx) => {
                const isSelected = selectedShotId === shot.id || (frameIndex >= shot.a && frameIndex <= shot.b);
                return (
                  <button
                    key={shot.id}
                    type="button"
                    className={`shot-marker-btn ${isSelected ? 'is-active' : ''}`}
                    onClick={() => {
                      setPlayingDraft(false);
                      onSelectShot(shot);
                      onChangeFrame(Math.min(shot.focusFrame, Math.max(0, project.durationFrames - 1)));
                    }}
                    title={shot.title}
                  >
                    Cảnh {idx + 1}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {stageMode === 'video' && project.latestExport && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a
            className="btn btn-primary"
            style={{ flex: 1 }}
            href={`${project.latestExport.videoUrl}?download=1`}
            download
          >
            Tải xuống MP4
          </a>
        </div>
      )}
    </aside>
  );
}
