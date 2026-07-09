import { useCallback, useState } from 'react';
import { StreamMode } from '../types';

const STORAGE_KEY = 'anitor_mode';

/**
 * Tracks whether the user wants streams to play in the embedded
 * browser player or be handed straight to VLC. `null` means no
 * choice has been made yet — that's what triggers the first-visit
 * mode selector screen in App.tsx.
 */
export function useStreamMode() {
  const [mode, setModeState] = useState<StreamMode | null>(() => {
    return (localStorage.getItem(STORAGE_KEY) as StreamMode) || null;
  });

  const selectMode = useCallback((next: StreamMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
  }, []);

  return { mode, selectMode };
}
