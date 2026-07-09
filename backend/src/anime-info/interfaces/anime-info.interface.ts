/** A single sequel/prequel relation entry from the Jikan API. */
export interface AnimeRelationEntry {
  relation: 'Sequel' | 'Prequel' | string;
  entries: { mal_id: number; name: string }[];
}

/** Shape returned by GET /api/anime-info. */
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
  relations: AnimeRelationEntry[];
}
