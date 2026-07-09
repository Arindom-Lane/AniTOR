import { useEffect, useState } from 'react';
import { animeApi } from '../api/animeApi';
import { AnimeInfo } from '../types';

type Status = 'idle' | 'loading' | 'found' | 'not-found' | 'error';

/**
 * Fetches anime metadata whenever `title` changes. Kept separate
 * from the stream-start flow so a slow or failed metadata lookup
 * can never delay or break video playback itself.
 */
export function useAnimeInfo(title: string | null) {
  const [info, setInfo] = useState<AnimeInfo | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (!title) {
      setInfo(null);
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setInfo(null);

    animeApi
      .getInfo(title)
      .then((result) => {
        if (cancelled) return;
        setInfo(result);
        setStatus(result ? 'found' : 'not-found');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [title]);

  return { info, status };
}
