import { useCallback, useEffect, useState } from 'react';
import { ThemeName } from '../types';

const STORAGE_KEY = 'theme';
const DEFAULT_THEME: ThemeName = 'dark';

/**
 * Reads/writes the active theme to localStorage and keeps the
 * <html data-theme="..."> attribute in sync, which is what makes
 * the CSS variables in styles/themes.css take effect.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    return (localStorage.getItem(STORAGE_KEY) as ThemeName) || DEFAULT_THEME;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeName) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  return { theme, setTheme };
}
