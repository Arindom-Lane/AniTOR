import { httpClient } from './httpClient';
import { AnimeInfo } from '../types';

export const animeApi = {
  /** Looks up anime metadata from a torrent's video filename. Returns null if not found. */
  getInfo: (title: string) =>
    httpClient.get<AnimeInfo | null>(`/api/anime-info?title=${encodeURIComponent(title)}`),
};
