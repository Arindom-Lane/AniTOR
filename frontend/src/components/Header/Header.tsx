import { ThemeSelect } from '../ThemeSelect/ThemeSelect';
import { StreamMode, ThemeName } from '../../types';
import './Header.css';

interface HeaderProps {
  mode: StreamMode;
  theme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
  onSwitchMode: () => void;
  onOpenHistory: () => void;
}

/** Top bar: logo, mode badge (reopens the mode selector), history button, theme picker. */
export function Header({ mode, theme, onThemeChange, onSwitchMode, onOpenHistory }: HeaderProps) {
  return (
    <header>
      <strong>AniTOR</strong>

      <div className="header-controls">
        <button className="mode-badge" onClick={onSwitchMode} title="Switch streaming mode">
          {mode === 'vlc' ? '🎬 VLC' : '🖥 Browser'}
        </button>

        <button className="btn-secondary" onClick={onOpenHistory}>
          History
        </button>

        <ThemeSelect value={theme} onChange={onThemeChange} />
      </div>
    </header>
  );
}
