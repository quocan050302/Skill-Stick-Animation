import { useEffect, useState } from 'react';
import type {
  ProjectRecord,
  QaReport,
  SceneOverrides,
  ShotOverride,
  TemplateInfo,
  TemplateShot,
} from '../types';
import { ShotList } from './ShotList';

interface ShotInspectorProps {
  project: ProjectRecord;
  template: TemplateInfo;
  selectedShotId: string | null;
  currentFrame: number;
  qaReport: QaReport | null;
  onSelectShot: (shot: TemplateShot) => void;
  onPatchProject: (patch: Record<string, unknown>) => Promise<void>;
  onUploadVoiceover: (file: File) => Promise<void>;
  onRemoveVoiceover: () => Promise<void>;
}

const SWATCH_HEX: Record<string, string> = {
  '': '#5c4b8a',
  coral: '#d9534f',
  teal: '#2d8b8b',
  gold: '#e0a82e',
};

export function ShotInspector({
  project,
  template,
  selectedShotId,
  currentFrame,
  qaReport,
  onSelectShot,
  onPatchProject,
  onUploadVoiceover,
  onRemoveVoiceover,
}: ShotInspectorProps) {
  const [activeTab, setActiveTab] = useState<'shots' | 'scene' | 'audio'>('shots');
  const [signDraft, setSignDraft] = useState(project.sceneOverrides?.signTitle || '');
  const [aisleDraft, setAisleDraft] = useState(project.sceneOverrides?.aisleLabel || '');
  const [scriptDraft, setScriptDraft] = useState(project.scriptText || '');
  const [uploadingVo, setUploadingVo] = useState(false);
  const [voError, setVoError] = useState<string | null>(null);

  useEffect(() => {
    setSignDraft(project.sceneOverrides?.signTitle || '');
    setAisleDraft(project.sceneOverrides?.aisleLabel || '');
    setScriptDraft(project.scriptText || '');
  }, [
    project.projectId,
    project.sceneOverrides?.signTitle,
    project.sceneOverrides?.aisleLabel,
    project.scriptText,
  ]);

  const shots = template.shots || [];
  const activeShot = shots.find((s) => s.id === selectedShotId) || shots[0] || null;
  const activeShotOverride: ShotOverride =
    project.shotOverrides?.find((s) => s.shotId === activeShot?.id) || {
      shotId: activeShot?.id || '',
      cameraPreset: 'default',
      lightingPreset: 'default',
      expression: 'default',
      pose: 'default',
      dofStrength: 'default',
    };

  const opts = template.supportedOptions || {};
  const editable = new Set(template.capabilities.editableFields || []);

  const updateShotField = (field: keyof ShotOverride, value: string) => {
    if (!activeShot) return;
    const nextShots = (project.shotOverrides || []).map((s) =>
      s.shotId === activeShot.id ? { ...s, [field]: value } : s
    );
    if (!nextShots.some((s) => s.shotId === activeShot.id)) {
      nextShots.push({ ...activeShotOverride, [field]: value });
    }
    void onPatchProject({ shotOverrides: nextShots });
  };

  const updateSceneField = (patch: Partial<SceneOverrides>) => {
    void onPatchProject({
      sceneOverrides: {
        ...project.sceneOverrides,
        ...patch,
      },
    });
  };

  const commitSign = () => {
    if (signDraft !== (project.sceneOverrides?.signTitle || '')) {
      updateSceneField({ signTitle: signDraft });
    }
  };

  const commitAisle = () => {
    if (aisleDraft !== (project.sceneOverrides?.aisleLabel || '')) {
      updateSceneField({ aisleLabel: aisleDraft });
    }
  };

  const commitScript = () => {
    if (scriptDraft !== project.scriptText) {
      void onPatchProject({ scriptText: scriptDraft });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingVo(true);
    setVoError(null);
    try {
      await onUploadVoiceover(file);
    } catch (err) {
      setVoError(err instanceof Error ? err.message : 'Không thể nạp tệp lời thoại.');
    } finally {
      setUploadingVo(false);
    }
  };

  return (
    <div className="card inspector-panel">
      <div className="tab-strip" role="tablist" aria-label="Bảng chỉnh sửa Studio">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'shots'}
          className={`tab-btn ${activeTab === 'shots' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('shots')}
          data-testid="tab-shots"
        >
          Cảnh & Máy quay
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'scene'}
          className={`tab-btn ${activeTab === 'scene' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('scene')}
          data-testid="tab-scene"
        >
          Bối cảnh & Kịch bản
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'audio'}
          className={`tab-btn ${activeTab === 'audio' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('audio')}
          data-testid="tab-audio"
        >
          Lời thoại & Thời lượng
        </button>
      </div>

      {activeTab === 'shots' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <ShotList
            shots={shots}
            selectedShotId={activeShot?.id || null}
            currentFrame={currentFrame}
            onSelectShot={onSelectShot}
          />

          {!template.capabilities.supportsShotOverrides ? (
            <div className="alert-banner">
              <span>
                Mẫu <strong>{template.name}</strong> dùng đường dẫn dựng Three.js gốc cố định nên khóa
                chỉnh sửa góc máy/tư thế từng cảnh để đảm bảo đúng bản gốc 1:1.
              </span>
            </div>
          ) : (
            activeShot && (
              <div className="form-grid" aria-label={`Chỉnh sửa ${activeShot.title}`}>
                {editable.has('cameraPreset') && opts.cameraPresets && (
                  <div className="field">
                    <label className="field-label" htmlFor="shot-camera-select">
                      Góc máy ({activeShot.title.split('·')[0].trim()})
                    </label>
                    <select
                      id="shot-camera-select"
                      className="select"
                      value={activeShotOverride.cameraPreset}
                      onChange={(e) => updateShotField('cameraPreset', e.target.value)}
                      data-testid="shot-camera-select"
                    >
                      {opts.cameraPresets.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editable.has('lightingPreset') && opts.lightingPresets && (
                  <div className="field">
                    <label className="field-label" htmlFor="shot-light-select">
                      Ánh sáng cảnh
                    </label>
                    <select
                      id="shot-light-select"
                      className="select"
                      value={activeShotOverride.lightingPreset}
                      onChange={(e) => updateShotField('lightingPreset', e.target.value)}
                      data-testid="shot-light-select"
                    >
                      {opts.lightingPresets.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editable.has('expression') && opts.expressions && (
                  <div className="field">
                    <label className="field-label" htmlFor="shot-expression-select">
                      Biểu cảm nhân vật
                    </label>
                    <select
                      id="shot-expression-select"
                      className="select"
                      value={activeShotOverride.expression}
                      onChange={(e) => updateShotField('expression', e.target.value)}
                      data-testid="shot-expression-select"
                    >
                      {opts.expressions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editable.has('pose') && opts.poses && (
                  <div className="field">
                    <label className="field-label" htmlFor="shot-pose-select">
                      Tư thế nhân vật
                    </label>
                    <select
                      id="shot-pose-select"
                      className="select"
                      value={activeShotOverride.pose}
                      onChange={(e) => updateShotField('pose', e.target.value)}
                      data-testid="shot-pose-select"
                    >
                      {opts.poses.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editable.has('dofStrength') && opts.dofStrengths && (
                  <div className="field">
                    <label className="field-label" htmlFor="shot-dof-select">
                      Xóa phông hậu cảnh (DOF)
                    </label>
                    <select
                      id="shot-dof-select"
                      className="select"
                      value={activeShotOverride.dofStrength}
                      onChange={(e) => updateShotField('dofStrength', e.target.value)}
                      data-testid="shot-dof-select"
                    >
                      {opts.dofStrengths.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}

      {activeTab === 'scene' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {template.capabilities.supportsSceneOverrides && (
            <div className="form-grid">
              {editable.has('signTitle') && (
                <div className="field">
                  <label className="field-label" htmlFor="scene-sign-input">
                    Biển hiệu chính (tối đa 18 ký tự)
                  </label>
                  <input
                    id="scene-sign-input"
                    className="input"
                    type="text"
                    maxLength={18}
                    value={signDraft}
                    onChange={(e) => setSignDraft(e.target.value)}
                    onBlur={commitSign}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        commitSign();
                        e.currentTarget.blur();
                      }
                    }}
                    data-testid="scene-sign-input"
                  />
                </div>
              )}

              {editable.has('aisleLabel') && (
                <div className="field">
                  <label className="field-label" htmlFor="scene-aisle-input">
                    Nhãn kệ hàng
                  </label>
                  <input
                    id="scene-aisle-input"
                    className="input"
                    type="text"
                    maxLength={18}
                    value={aisleDraft}
                    onChange={(e) => setAisleDraft(e.target.value)}
                    onBlur={commitAisle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        commitAisle();
                        e.currentTarget.blur();
                      }
                    }}
                    data-testid="scene-aisle-input"
                  />
                </div>
              )}

              {opts.sceneLightingPresets && (
                <div className="field">
                  <label className="field-label" htmlFor="scene-lighting-select">
                    Ánh sáng toàn cảnh
                  </label>
                  <select
                    id="scene-lighting-select"
                    className="select"
                    value={project.sceneOverrides?.lightingPreset || 'auto'}
                    onChange={(e) => updateSceneField({ lightingPreset: e.target.value })}
                    data-testid="scene-lighting-select"
                  >
                    {opts.sceneLightingPresets.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editable.has('visualFoundation') && opts.visualFoundations && (
                <div className="field">
                  <label className="field-label" htmlFor="scene-visual-foundation-select">
                    Chất lượng nền thị giác
                  </label>
                  <select
                    id="scene-visual-foundation-select"
                    className="select"
                    value={project.sceneOverrides?.visualFoundation || 'baseline'}
                    onChange={(e) =>
                      updateSceneField({
                        visualFoundation: e.target.value as 'baseline' | 'enhanced',
                      })
                    }
                    data-testid="scene-visual-foundation-select"
                  >
                    {opts.visualFoundations.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editable.has('characterStyle') && opts.characterStyles && (
                <div className="field">
                  <label className="field-label" htmlFor="scene-char-style-select">
                    Nhân vật chính
                  </label>
                  <select
                    id="scene-char-style-select"
                    className="select"
                    value={project.sceneOverrides?.characterStyle || 'courierKid'}
                    onChange={(e) => updateSceneField({ characterStyle: e.target.value })}
                    data-testid="scene-char-style-select"
                  >
                    {opts.characterStyles.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {editable.has('hoodieColor') && opts.hoodieColors && (
            <div className="field">
              <span className="field-label">Màu áo hoodie nhân vật</span>
              <div className="swatch-row">
                {opts.hoodieColors.map((o) => {
                  const selected = (project.sceneOverrides?.hoodieColor || '') === o.value;
                  return (
                    <button
                      key={o.value || 'default'}
                      type="button"
                      className={`swatch-btn ${selected ? 'is-selected' : ''}`}
                      onClick={() => updateSceneField({ hoodieColor: o.value })}
                    >
                      <span
                        className="swatch-chip"
                        style={{ background: o.value || SWATCH_HEX[''] }}
                        aria-hidden="true"
                      />
                      <span>{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {editable.has('parcelColor') && opts.parcelColors && (
            <div className="field">
              <span className="field-label">Màu kiện hàng chính</span>
              <div className="swatch-row">
                {opts.parcelColors.map((o) => {
                  const selected = (project.sceneOverrides?.parcelColor || 'coral') === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      className={`swatch-btn ${selected ? 'is-selected' : ''}`}
                      onClick={() => updateSceneField({ parcelColor: o.value })}
                      data-testid={`parcel-swatch-${o.value}`}
                    >
                      <span
                        className="swatch-chip"
                        style={{ background: SWATCH_HEX[o.value] || '#d9534f' }}
                        aria-hidden="true"
                      />
                      <span>{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor="scene-script-textarea">
              Kịch bản / Ghi chú lời thoại
            </label>
            <textarea
              id="scene-script-textarea"
              className="textarea"
              value={scriptDraft}
              onChange={(e) => setScriptDraft(e.target.value)}
              onBlur={commitScript}
              rows={4}
              maxLength={4000}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn"
                onClick={commitScript}
                disabled={scriptDraft === project.scriptText}
              >
                Lưu kịch bản
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'audio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="upload-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div>
                <strong style={{ display: 'block' }}>Tệp lời thoại (WAV / MP3 / M4A)</strong>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Nếu không gắn lời thoại, hệ thống dùng nhạc & SFX nền chuẩn của mẫu.
                </span>
              </div>
              <label className="btn" htmlFor="voiceover-file-input">
                {uploadingVo ? 'Đang nạp...' : project.voiceover ? 'Đổi tệp thoại' : 'Tải lên lời thoại'}
              </label>
              <input
                id="voiceover-file-input"
                type="file"
                accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4"
                onChange={(e) => void handleFileChange(e)}
                style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, overflow: 'hidden' }}
                data-testid="voiceover-file-input"
              />
            </div>

            {voError && (
              <div className="alert-banner is-danger" role="alert">
                <span>{voError}</span>
              </div>
            )}

            {project.voiceover ? (
              <div className="qa-item" style={{ background: 'var(--surface)' }}>
                <div className="meta-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: 'var(--text)' }}>{project.voiceover.originalFilename}</strong>
                  <button type="button" className="btn btn-danger" onClick={() => void onRemoveVoiceover()}>
                    Gỡ bỏ
                  </button>
                </div>
                <div className="meta-row">
                  <span>Thời lượng FFprobe: {project.voiceover.durationSeconds.toFixed(2)}s</span>
                  <span>·</span>
                  <span>{project.timing?.voiceoverFrames} khung @ 30fps</span>
                  <span>·</span>
                  <span>{project.voiceover.codec || 'audio'}</span>
                </div>
              </div>
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Trạng thái hiện tại: Không có lời thoại (nhạc + SFX tổng hợp).
              </span>
            )}
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={project.syncDurationToVoiceover}
              onChange={(e) => void onPatchProject({ syncDurationToVoiceover: e.target.checked })}
            />
            <span>Khớp số khung video theo thời lượng lời thoại (round(thời lượng × 30))</span>
          </label>

          {project.timing?.conflict && (
            <div
              className={`alert-banner ${project.timing.syncMode === 'conflict' ? 'is-danger' : 'is-warning'}`}
              role="alert"
            >
              <span>{project.timing.conflict.message}</span>
            </div>
          )}

          {qaReport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <strong style={{ fontSize: '14px' }}>
                Kết quả kiểm định bản xuất gần nhất ({qaReport.overallStatus})
              </strong>
              <div className="qa-grid">
                {qaReport.gates.map((g) => (
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
                    <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{g.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
