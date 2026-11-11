var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AnimeService_1;
import { Injectable, Logger } from '@nestjs/common';
let AnimeService = AnimeService_1 = class AnimeService {
    log = new Logger(AnimeService_1.name);
    cache = new Map();
    parseAnimeName(filename) {
        let n = filename.replace(/\.[^.]+$/, '');
        n = n.replace(/^\[.*?\]\s*/, '');
        n = n.replace(/\s*[\[(][^\])"]+[\])]/g, '');
        n = n.replace(/[-_\s]+(?:S\d+E\d+|\d{2,3}v?\d?).*$/i, '');
        n = n.replace(/\bEpisodes?\s*\d+.*/i, '');
        n = n.replace(/[._]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        return n;
    }
    async lookup(filename) {
        const query = this.parseAnimeName(filename);
        if (query.length < 2)
            return null;
        const cached = this.cache.get(query);
        if (cached)
            return cached;
        try {
            const search = await this.jikan(`/anime?q=${encodeURIComponent(query)}&limit=1&sfw=false`);
            const a = search.data?.[0];
            if (!a)
                return null;
            let relations = [];
            try {
                const rel = await this.jikan(`/anime/${a.mal_id}/relations`);
                relations = (rel.data ?? [])
                    .filter((r) => r.relation === 'Sequel' || r.relation === 'Prequel')
                    .map((r) => ({ relation: r.relation, entries: r.entry }));
            }
            catch {
            }
            const info = {
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
        }
        catch (err) {
            this.log.warn(`Jikan lookup failed: ${err.message}`);
            return null;
        }
    }
    async jikan(path) {
        const res = await fetch(`https://api.jikan.moe/v4${path}`, {
            headers: { 'User-Agent': 'AniTOR/2.0' },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        return (await res.json());
    }
};
AnimeService = AnimeService_1 = __decorate([
    Injectable()
], AnimeService);
export { AnimeService };
//# sourceMappingURL=anime.service.js.map