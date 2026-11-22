import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { Torrent, TorrentFile } from 'webtorrent';
export interface StartedTorrent {
    title: string;
    magnet: string;
}
export interface StreamRange {
    file: TorrentFile;
    start: number;
    end: number;
    size: number;
    mime: string;
    partial: boolean;
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
    start(source: string | Buffer): Promise<StartedTorrent>;
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
    resolveRange(rangeHeader?: string): StreamRange;
    openStream({ file, start, end }: StreamRange): Readable;
    private windowed;
    private getVideoFile;
    private whenReady;
    private badRange;
    private cleanupIfIdle;
}
