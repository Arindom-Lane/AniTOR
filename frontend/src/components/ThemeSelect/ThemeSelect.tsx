import { ThemeName } from '../../types';

const THEMES: { value: ThemeName; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'light', label: 'Light' },
  { value: 'atom-material', label: 'Atom Material' },
  { value: 'default', label: 'Default' },
  { value: 'github-dark', label: 'GitHub Dark' },
  { value: 'hopscotch', label: 'Hopscotch' },
  { value: 'monokai', label: 'Monokai' },
  { value: 'okaidia', label: 'Okaidia' },
  { value: 'one-dark', label: 'One Dark' },
  { value: 'pojoaque', label: 'Pojoaque' },
  { value: 'solarized-dark', label: 'Solarized Dark' },
  { value: 'twilight', label: 'Twilight' },
  { value: 'xonokai', label: 'Xonokai' },
];

interface ThemeSelectProps {
  value: ThemeName;
  onChange: (theme: ThemeName) => void;
}

/** Dropdown that switches the data-theme attribute driving styles/themes.css. */
export function ThemeSelect({ value, onChange }: ThemeSelectProps) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as ThemeName)}>
      {THEMES.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );
}
