import { KeyboardEvent } from 'react';
import { StreamMode } from '../../types';

interface MagnetInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  mode: StreamMode;
}

/**
 * Magnet link input + start button, shared by both streaming modes.
 * Styled entirely by the shared `.input-wrapper` rule in styles/global.css
 * — nothing here is specific enough to warrant its own CSS file.
 */
export function MagnetInputBar({ value, onChange, onSubmit, isLoading, mode }: MagnetInputBarProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSubmit();
  };

  return (
    <div className="input-wrapper">
      <input
        type="text"
        placeholder="Paste magnet link…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button onClick={onSubmit} disabled={isLoading}>
        {isLoading ? 'Loading…' : mode === 'vlc' ? 'Open in VLC' : 'Start Stream'}
      </button>
    </div>
  );
}
