/**
 * Shape returned by GET /api/stats.
 * Numbers are strings for progress/downloadSpeed because they're
 * pre-formatted (toFixed) for direct display — the frontend doesn't
 * need to reformat them.
 */
export interface TorrentStats {
  active: boolean;
  paused?: boolean;
  progress?: string; // e.g. "42.3" (percent)
  downloadSpeed?: string; // e.g. "1.85" (MB/s)
  peers?: number;
}
