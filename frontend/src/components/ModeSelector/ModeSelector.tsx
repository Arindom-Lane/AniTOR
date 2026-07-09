import { MouseEvent } from 'react';
import { StreamMode } from '../../types';
import './ModeSelector.css';

interface ModeSelectorProps {
  onSelect: (mode: StreamMode) => void;
  /** Whether clicking the dark backdrop closes this without picking. */
  dismissable?: boolean;
  onDismiss?: () => void;
}

/**
 * Full-screen mode picker. Shown on first visit — not dismissable,
 * the user must choose — and again whenever the header's mode badge
 * is clicked, where it IS dismissable since changing your mind is optional.
 */
export function ModeSelector({ onSelect, dismissable = false, onDismiss }: ModeSelectorProps) {
  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (dismissable && e.target === e.currentTarget) {
      onDismiss?.();
    }
  };

  return (
    <div className="mode-selector-overlay" onClick={handleOverlayClick}>
      <div className="mode-selector-box">
        <div className="ms-logo">
          <span className="ms-logo-a">A</span>
          <span className="ms-logo-text">AniTOR</span>
        </div>

        <p className="ms-sub">How do you want to stream?</p>

        <div className="mode-cards">
          <button className="mode-card" onClick={() => onSelect('browser')}>
            <span className="mode-card-icon">🖥️</span>
            <h2>Browser</h2>
            <p>
              Embedded player right in your browser. One-click handoff to VLC
              whenever you need subtitle or audio control.
            </p>
            <span className="mode-card-cta">Select</span>
          </button>

          <button className="mode-card" onClick={() => onSelect('vlc')}>
            <span className="mode-card-icon">🎬</span>
            <h2>VLC Direct</h2>
            <p>
              Every stream opens straight in VLC — multiple subtitle tracks,
              custom .srt upload, and dual audio from the start.
            </p>
            <span className="mode-card-cta">Select</span>
          </button>
        </div>
      </div>
    </div>
  );
}
