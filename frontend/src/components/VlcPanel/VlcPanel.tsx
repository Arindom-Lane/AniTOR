import './VlcPanel.css';

interface VlcPanelProps {
  title: string;
  statusMessage: string | null;
}

/** Status card + feature breakdown shown in VLC Direct mode instead of an embedded player. */
export function VlcPanel({ title, statusMessage }: VlcPanelProps) {
  return (
    <>
      <div className="vlc-status-card">
        <span className="vlc-live-dot" />
        <div className="vlc-status-body">
          <h3>{title}</h3>
          <p>{statusMessage ?? '—'}</p>
        </div>
      </div>

      <div className="vlc-features-card">
        <p className="vlc-feat-heading">What you get in VLC</p>
        <ul className="vlc-feat-list">
          <li>
            <span className="feat-icon">📝</span>
            <div>
              <strong>Multiple subtitle tracks</strong>
              <span>
                Switch between any subtitle embedded in the file — Japanese, English,
                romaji, or any fansub track. Use <em>Video → Subtitle Track</em>.
              </span>
            </div>
          </li>

          <li>
            <span className="feat-icon">📁</span>
            <div>
              <strong>Upload custom subtitles</strong>
              <span>
                Load your own .srt, .ass, or .ssa files directly via{' '}
                <em>Media → Add Subtitle File</em>. No re-encoding or remux needed.
              </span>
            </div>
          </li>

          <li>
            <span className="feat-icon">🔊</span>
            <div>
              <strong>Dual audio &amp; track switching</strong>
              <span>
                Toggle between Japanese original, English dub, or any other audio track
                via <em>Audio → Audio Track</em>.
              </span>
            </div>
          </li>

          <li>
            <span className="feat-icon">⚡</span>
            <div>
              <strong>Full hardware decode</strong>
              <span>
                GPU-accelerated playback, frame-precise stepping, subtitle/audio sync
                offset control — all live over the stream.
              </span>
            </div>
          </li>
        </ul>
      </div>
    </>
  );
}
