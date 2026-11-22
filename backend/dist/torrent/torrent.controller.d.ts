import type { Request, Response } from 'express';
import { HistoryService } from '../history/history.service.js';
import { TorrentService } from './torrent.service.js';
export declare class TorrentController {
    private readonly torrents;
    private readonly history;
    constructor(torrents: TorrentService, history: HistoryService);
    start(body?: {
        magnetLink?: unknown;
        torrentFile?: unknown;
    }): Promise<{
        title: string;
    }>;
    videoStream(req: Request, res: Response): undefined;
    pause(): void;
    resume(): void;
    stop(): Promise<void>;
    stats(): {
        active: boolean;
        paused?: undefined;
        progress?: undefined;
        downloadSpeed?: undefined;
        peers?: undefined;
    } | {
        active: boolean;
        paused: boolean;
        progress: string;
        downloadSpeed: string;
        peers: number;
    };
}
