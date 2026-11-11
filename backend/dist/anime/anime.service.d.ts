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
    relations: {
        relation: string;
        entries: unknown[];
    }[];
}
export declare class AnimeService {
    private readonly log;
    private readonly cache;
    parseAnimeName(filename: string): string;
    lookup(filename: string): Promise<AnimeInfo | null>;
    private jikan;
}
