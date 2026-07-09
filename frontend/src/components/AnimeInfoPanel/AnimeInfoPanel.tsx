import { AnimeInfo } from '../../types';
import './AnimeInfoPanel.css';

interface AnimeInfoPanelProps {
  info: AnimeInfo | null;
  status: 'idle' | 'loading' | 'found' | 'not-found' | 'error';
}

/**
 * Right-hand sidebar: poster, title, genres/studios, episode/status
 * table, synopsis, and sequel/prequel links.
 *
 * Note: unlike the original vanilla-JS version, this never needs a
 * manual HTML-escaping helper — JSX escapes all text content by
 * default, so filenames/API data can never inject markup here.
 */
export function AnimeInfoPanel({ info, status }: AnimeInfoPanelProps) {
  if (status === 'loading' || status === 'idle') {
    return (
      <aside className="anime-panel">
        <p className="anime-loading">Fetching info…</p>
      </aside>
    );
  }

  if (status === 'not-found' || !info) {
    return (
      <aside className="anime-panel">
        <p className="anime-loading">No info found</p>
      </aside>
    );
  }

  if (status === 'error') {
    return (
      <aside className="anime-panel">
        <p className="anime-loading">Could not load info</p>
      </aside>
    );
  }

  const synopsis =
    info.synopsis && info.synopsis.length > 380
      ? info.synopsis.slice(0, 380) + '…'
      : info.synopsis;

  return (
    <aside className="anime-panel">
      {info.poster && (
        <img className="anime-poster" src={info.poster} alt={info.title} loading="lazy" />
      )}

      <div className="anime-body">
        <div className="anime-title-row">
          <h2 className="anime-name">{info.title}</h2>
          <div className="anime-badges">
            {info.score && <span className="score-badge">⭐ {info.score}</span>}
            {info.rank && <span className="rank-badge">#{info.rank}</span>}
          </div>
        </div>

        {info.titleJapanese && <p className="anime-name-jp">{info.titleJapanese}</p>}

        {(info.genres.length > 0 || info.studios.length > 0) && (
          <div className="anime-tags">
            {info.genres.map((g) => (
              <span key={g} className="tag">
                {g}
              </span>
            ))}
            {info.studios.map((s) => (
              <span key={s} className="tag tag-studio">
                {s}
              </span>
            ))}
          </div>
        )}

        {(info.episodes || info.status || info.aired) && (
          <table className="anime-meta-table">
            <tbody>
              {info.episodes && (
                <tr>
                  <td>Episodes</td>
                  <td>{info.episodes}</td>
                </tr>
              )}
              {info.status && (
                <tr>
                  <td>Status</td>
                  <td>{info.status}</td>
                </tr>
              )}
              {info.aired && (
                <tr>
                  <td>Aired</td>
                  <td>{info.aired}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {synopsis && <p className="anime-synopsis">{synopsis}</p>}

        {info.relations.length > 0 && (
          <div className="anime-relations">
            {info.relations.flatMap((rel) =>
              rel.entries.map((e) => (
                <span key={`${rel.relation}-${e.mal_id}`} className="relation-entry">
                  <span className="rel-type">{rel.relation}</span>
                  {e.name}
                </span>
              )),
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
