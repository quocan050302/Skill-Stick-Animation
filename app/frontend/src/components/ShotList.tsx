import type { TemplateShot } from '../types';

interface ShotListProps {
  shots: TemplateShot[];
  selectedShotId: string | null;
  currentFrame: number;
  onSelectShot: (shot: TemplateShot) => void;
}

export function ShotList({ shots, selectedShotId, currentFrame, onSelectShot }: ShotListProps) {
  if (shots.length === 0) return null;
  return (
    <div className="shot-list" role="listbox" aria-label="Danh sách cảnh quay">
      {shots.map((shot) => {
        const isSelected = shot.id === selectedShotId;
        const isInFrame = currentFrame >= shot.a && currentFrame <= shot.b;
        return (
          <button
            key={shot.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            className={`shot-item-btn ${isSelected ? 'is-selected' : ''}`}
            onClick={() => onSelectShot(shot)}
            data-testid={`shot-item-${shot.id}`}
          >
            <span className="shot-item-title">{shot.title}</span>
            <span className="shot-item-range">
              Khung {shot.a}–{shot.b} {isInFrame ? '· Đang xem' : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
