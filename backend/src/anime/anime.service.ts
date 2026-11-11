import { Injectable, Logger } from '@nestjs/common';

interface JikanEntry {
  mal_id: number;
  title: string;
  title_english?: string;
  title_japanese?: string;
  images?: { jpg?: { large_image_url?: string; image_url?: string } };
  synopsis?: string;
  score?: number;
  rank?: number;
  episodes?: number;
  status?: string;
  aired?: { string?: string };
  genres?: { name: string }[];
  studios?: { name: string }[];
}

interface JikanRelation {
  relation: string;
  entry: unknown[];
}

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
  relations: { relation: string; entries: unknown[] }[];
}

@Injectable()
export class AnimeService {
  private readonly log = new Logger(AnimeService.name);
  private readonly cache = new Map<string, AnimeInfo>();

  /**
   * "[HorribleSubs] Demon Slayer - 01 [1080p].mkv"  ->  "Demon Slayer"
   */
  parseAnimeName(filename: string): string {
    let n = filename.replace(/\.[^.]+$/, ''); // drop extension
    n = n.replace(/^\[.*?\]\s*/, ''); // drop leading [Group]
    n = n.replace(/\s*[\[(][^\])"]+[\])]/g, ''); // drop all [tag] / (tag)
    n = n.replace(/[-_\s]+(?:S\d+E\d+|\d{2,3}v?\d?).*$/i, ''); // drop ep numbers
    n = n.replace(/\bEpisodes?\s*\d+.*/i, '');
    n = n.replace(/[._]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    return n;
  }

  async lookup(filename: string): Promise<AnimeInfo | null> {
    const query = this.parseAnimeName(filename);
    if (query.length < 2) return null;

    const cached = this.cache.get(query);
    if (cached) return cached;

    try {
      const search = await this.jikan<{ data?: JikanEntry[] }>(
        `/anime?q=${encodeURIComponent(query)}&limit=1&sfw=false`,
      );
      const a = search.data?.[0];
      if (!a) return null;

      let relations: AnimeInfo['relations'] = [];
      try {
        const rel = await this.jikan<{ data?: JikanRelation[] }>(
          `/anime/${a.mal_id}/relations`,
        );
        relations = (rel.data ?? [])
          .filter((r) => r.relation === 'Sequel' || r.relation === 'Prequel')
          .map((r) => ({ relation: r.relation, entries: r.entry }));
      } catch {
        /* relations are optional */
      }

      const info: AnimeInfo = {
        malId: a.mal_id,
        title: a.title_english || a.title,
        titleJapanese: a.title_japanese,
        poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url,
        synopsis: a.synopsis,
        score: a.score,
        rank: a.rank,
        episodes: a.episodes,
        status: a.status,
        aired: a.aired?.string,
        genres: (a.genres ?? []).map((g) => g.name),
        studios: (a.studios ?? []).map((s) => s.name),
        relations,
      };
      this.cache.set(query, info);
      return info;
    } catch (err) {
      this.log.warn(`Jikan lookup failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async jikan<T>(path: string): Promise<T> {
    const res = await fetch(`https://api.jikan.moe/v4${path}`, {
      headers: { 'User-Agent': 'AniTOR/2.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  }
}