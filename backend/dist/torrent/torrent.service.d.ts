import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Readable } from 'node:stream';
import type { Torrent } from 'webtorrent';
export interface RangeResult {
    stream: Readable;
    start: number;
    end: number;
    size: number;
    mime: string;
}
export declare class TorrentService implements OnModuleInit, OnModuleDestroy {
    private readonly log;
    private readonly client;
    private current;
    private readonly streams;
    private lastActivity;
    private paused;
    private idleTimer?;
    onModuleInit(): void;
    onModuleDestroy(): Promise<void>;
    start(magnetLink: string): Promise<string>;
    destroyTorrent(only?: Torrent): Promise<void>;
    hasActive(): boolean;
    pause(): void;
    resume(): void;
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
    readRange(rangeHeader?: string): RangeResult;
    private getVideoFile;
    private whenReady;
    private badRange;
    private cleanupIfIdle;
}
