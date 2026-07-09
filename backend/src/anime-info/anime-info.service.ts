import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import { parseAnimeName } from './utils/parse-anime-name.util';
import { AnimeInfo } from './interfaces/anime-info.interface';

const JIKAN_BASE = 'https://api.jikan.moe/v4';

@Injectable()
export class AnimeInfoService {
  private readonly logger = new Logger(AnimeInfoService.name);

  /**
   * Minimal promise-based HTTPS GET + JSON parse. Deliberately not
   * using axios/got here — this is the only external call in the
   * whole app, so a tiny wrapper around Node's built-in `https`
   * avoids adding a dependency for one call site.
   */
  private httpsGetJson<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { headers: { 'User-Agent': 'AniTOR/2.0' } }, (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (err) {
            reject(err);
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(8000, () => {
        req.destroy();
        reject(new Error('Jikan request timed out'));
      });
    });
  }

  /**
   * Look up anime metadata on MyAnimeList (via the free Jikan API)
   * from a torrent's video filename. Returns null if nothing is
   * found or the lookup fails — this panel is a "nice to have",
   * so a failure here should never break streaming itself.
   */
  async fetchInfo(filename: string): Promise<AnimeInfo | null> {
    try {
      const query = parseAnimeName(filename);
      if (!query || query.length < 2) return null;

      const search = await this.httpsGetJson<any>(
        `${JIKAN_BASE}/anime?q=${encodeURIComponent(query)}&limit=1&sfw=false`,
      );

      const match = search?.data?.[0];
      if (!match) return null;

      const relations = await this.fetchRelations(match.mal_id);

      return {
        malId: match.mal_id,
        title: match.title_english || match.title,
        titleJapanese: match.title_japanese,
        poster: match.images?.jpg?.large_image_url || match.images?.jpg?.image_url,
        synopsis: match.synopsis,
        score: match.score,
        rank: match.rank,
        episodes: match.episodes,
        status: match.status,
        aired: match.aired?.string,
        genres: (match.genres || []).map((g: any) => g.name),
        studios: (match.studios || []).map((s: any) => s.name),
        relations,
      };
    } catch (err) {
      this.logger.warn(`Anime lookup failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Fetch only Sequel / Prequel relations for the given MyAnimeList id. */
  private async fetchRelations(malId: number) {
    try {
      const rel = await this.httpsGetJson<any>(`${JIKAN_BASE}/anime/${malId}/relations`);
      return (rel?.data || [])
        .filter((r: any) => r.relation === 'Sequel' || r.relation === 'Prequel')
        .map((r: any) => ({ relation: r.relation, entries: r.entry }));
    } catch {
      return [];
    }
  }
}
