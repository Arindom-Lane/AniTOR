import { TorrentStats } from '../../types';
import './Footer.css';

interface FooterProps {
  stats: TorrentStats;
  visible: boolean;
}

/** Bottom bar: live download stats (while streaming) + GitHub link. */
export function Footer({ stats, visible }: FooterProps) {
  return (
    <footer>
      {visible && (
        <div className="telemetry-metrics">
          <span>
            Speed: <strong>{stats.downloadSpeed ?? '0.00'} MB/s</strong>
          </span>
          <span>
            Peers: <strong>{stats.peers ?? 0}</strong>
          </span>
          <span>
            Progress: <strong>{stats.progress ?? '0.0'}%</strong>
          </span>
          {stats.paused && <span className="badge-paused">⏸ Paused</span>}
        </div>
      )}

      <a
        href="https://github.com/Arindom-Lane/AniTOR"
        target="_blank"
        rel="noreferrer"
        className="btn-secondary"
      >
        GitHub
      </a>
    </footer>
  );
}
