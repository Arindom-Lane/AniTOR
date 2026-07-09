import { useEffect, useRef, useState } from 'react';
import { torrentApi } from '../api/torrentApi';
import { TorrentStats } from '../types';

/**
 * Polls /api/stats once per second while `active` is true, and stops
 * (clearing the interval) the moment `active` goes false — so no
 * stray requests keep firing after a stream ends.
 */
export function useTorrentStats(active: boolean) {
  const [stats, setStats] = useState<TorrentStats>({ active: false });
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!active) {
      clearInterval(intervalRef.current);
      return;
    }

    const poll = async () => {
      try {
        const data = await torrentApi.getStats();
        setStats(data);
      } catch {
        // A transient network hiccup shouldn't crash the UI — the
        // next poll a second later will just try again.
      }
    };

    poll(); // fetch immediately instead of waiting a full second
    intervalRef.current = setInterval(poll, 1000);

    return () => clearInterval(intervalRef.current);
  }, [active]);

  return stats;
}
