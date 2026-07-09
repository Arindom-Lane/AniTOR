/** A single entry in stream history. */
export interface HistoryItem {
  title: string;
  magnetLink: string;
}

/** Live torrent/download stats polled from the backend. */
export interface TorrentStats {
  active: boolean;
  paused?: boolean;
  progress?: string;
  downloadSpeed?: string;
  peers?: number;
}

/** A sequel/prequel relation returned by the anime-info endpoint. */
export interface AnimeRelation {
  relation: 'Sequel' | 'Prequel' | string;
  entries: { mal_id: number; name: string }[];
}

/** Anime metadata fetched from MyAnimeList (via Jikan) for the current stream. */
export interface AnimeInfo {
  malId: number;
  title: string;
  titleJapanese?: string;
  poster?: string;
  synopsis?: string;
  score?: number;
  rank?: number;
  episodes?: number;
  status?: string;
  aired?: string;
  genres: string[];
  studios: string[];
  relations: AnimeRelation[];
}

/** How the user wants streams to open. */
export type StreamMode = 'browser' | 'vlc';

/** One of the CSS themes defined in styles/themes.css. */
export type ThemeName =
  | 'dark'
  | 'cyan'
  | 'light'
  | 'atom-material'
  | 'default'
  | 'github-dark'
  | 'hopscotch'
  | 'monokai'
  | 'okaidia'
  | 'one-dark'
  | 'pojoaque'
  | 'solarized-dark'
  | 'twilight'
  | 'xonokai';
