// WebTorrent 2.x ships no TypeScript types, so we describe just the parts we use.
declare module 'webtorrent' {
  import type { Readable } from 'node:stream';

  export interface TorrentFile {
    name: string;
    length: number;
    offset: number; // where this file starts inside the whole torrent
    createReadStream(opts?: { start?: number; end?: number }): Readable;
  }

  export interface Torrent {
    infoHash: string;
    ready: boolean;
    destroyed: boolean;
    files: TorrentFile[];
    pieces: unknown[];
    pieceLength: number;
    progress: number;
    downloadSpeed: number;
    numPeers: number;
    pause(): void;
    resume(): void;
    select(start: number, end: number, priority?: number | boolean): void;
    deselect(start: number, end: number): void;
    destroy(opts: { destroyStore?: boolean }, cb?: () => void): void;
    on(event: 'error', listener: (err: Error | string) => void): this;
    once(event: 'ready' | 'close', listener: () => void): this;
    once(event: 'error', listener: (err: Error | string) => void): this;
  }

  export default class WebTorrent {
    constructor(opts?: Record<string, unknown>);
    add(id: string, opts?: Record<string, unknown>): Torrent;
    destroy(cb?: (err?: Error | string | null) => void): void;
    on(event: 'error', listener: (err: Error | string) => void): this;
  }
}

// memory-chunk-store is plain JavaScript without types either.
declare module 'memory-chunk-store';