import {
  BadRequestException,
  ConflictException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import MemoryStore from 'memory-chunk-store';
import { extname } from 'node:path';
import type { Readable } from 'node:stream';
import WebTorrent from 'webtorrent';
import type { Torrent, TorrentFile } from 'webtorrent';
import { IDLE_TIMEOUT_MS, METADATA_TIMEOUT_MS } from '../config.js';

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
};

export interface RangeResult {
  stream: Readable;
  start: number;
  end: number;
  size: number;
  mime: string;
}

@Injectable()
export class TorrentService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(TorrentService.name);
  private readonly client = new WebTorrent();

  private current: Torrent | null = null;
  private readonly streams = new Set<Readable>();
  private lastActivity = Date.now();
  private paused = false;
  private idleTimer?: NodeJS.Timeout;

  onModuleInit() {
    // Without this an unexpected WebTorrent error would crash the whole process.
    this.client.on('error', (err) => this.log.error(`client error: ${String(err)}`));
    this.idleTimer = setInterval(() => void this.cleanupIfIdle(), 5000);
  }

  async onModuleDestroy() {
    clearInterval(this.idleTimer);
    await this.destroyTorrent();
    this.client.destroy();
  }

  // ------------------------------------------------------------------
  // Start / stop
  // ------------------------------------------------------------------

  /** Adds the magnet, waits for metadata, returns the video file name. */
  async start(magnetLink: string): Promise<string> {
    await this.destroyTorrent();
    this.lastActivity = Date.now();
    this.paused = false;

    let torrent: Torrent;
    try {
      // MemoryStore = pieces live in RAM, nothing is written to your SSD.
      torrent = this.client.add(magnetLink, { store: MemoryStore });
    } catch {
      throw new BadRequestException('Invalid magnet link');
    }
    this.current = torrent;
    torrent.on('error', (err) => this.log.warn(`torrent error: ${String(err)}`));

    try {
      await this.whenReady(torrent);
    } catch (err) {
      await this.destroyTorrent(torrent);
      throw err;
    }

    const video = this.getVideoFile(torrent);
    if (!video) {
      await this.destroyTorrent(torrent);
      throw new NotFoundException('No video file found in torrent');
    }

    // Halt everything; readRange() resumes it when the player asks for data.
    torrent.pause();
    this.paused = true;
    this.lastActivity = Date.now();
    return video.name;
  }

  /** Tears the torrent down. If `only` is given, acts only if it is still the current one. */
  async destroyTorrent(only?: Torrent): Promise<void> {
    const torrent = this.current;
    if (!torrent || (only && only !== torrent)) return;

    this.log.log('Destroying torrent…');
    for (const s of this.streams) s.destroy();
    this.streams.clear();
    this.current = null;
    this.paused = false;

    // torrent.destroy() also removes it from the client. We skip torrents that
    // WebTorrent already destroyed itself (e.g. invalid magnet): destroying twice
    // would never call back and the request would hang.
    await new Promise<void>((resolve) => {
      if (torrent.destroyed) return resolve();
      torrent.destroy({ destroyStore: true }, () => resolve());
    });
  }

  hasActive(): boolean {
    return this.current !== null;
  }

  // ------------------------------------------------------------------
  // Pause / resume / stats
  // ------------------------------------------------------------------

  pause() {
    if (this.current && !this.paused) {
      this.current.pause();
      this.paused = true;
      this.log.log('Download paused');
    }
  }

  resume() {
    if (this.current && this.paused) {
      this.current.resume();
      this.paused = false;
      this.log.log('Download resumed');
    }
  }

  stats() {
    const t = this.current;
    if (!t) return { active: false };
    return {
      active: true,
      paused: this.paused,
      progress: (t.progress * 100).toFixed(1),
      downloadSpeed: (t.downloadSpeed / 1024 / 1024).toFixed(2),
      peers: t.numPeers,
    };
  }

  // ------------------------------------------------------------------
  // Byte-range streaming
  // ------------------------------------------------------------------

  readRange(rangeHeader?: string): RangeResult {
    const torrent = this.current;
    if (!torrent) throw new BadRequestException('No active torrent');

    const file = this.getVideoFile(torrent);
    if (!file) throw new NotFoundException('No video file');
    if (!rangeHeader) throw new BadRequestException('Range header required');

    const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
    if (!match) throw this.badRange();

    const start = Number(match[1]);
    const end = match[2]
      ? Math.min(Number(match[2]), file.length - 1)
      : Math.min(start + 4 * 1024 * 1024, file.length - 1); // 4 MB window
    if (start > end) throw this.badRange();

    // Which torrent pieces cover this byte range? file.offset matters when the
    // torrent has several files: the video does not start at byte 0 then.
    const pieceLen = torrent.pieceLength;
    const lastPiece = torrent.pieces.length - 1;
    const p0 = Math.max(0, Math.floor((file.offset + start) / pieceLen));
    const p1 = Math.min(Math.floor((file.offset + end) / pieceLen) + 2, lastPiece);

    if (this.paused) {
      torrent.resume();
      this.paused = false;
    }
    torrent.deselect(0, lastPiece); // clear everything...
    torrent.select(p0, p1, true); // ...and fetch only what playback needs now

    const stream = file.createReadStream({ start, end });
    this.streams.add(stream);
    this.lastActivity = Date.now();

    stream.on('data', () => (this.lastActivity = Date.now()));
    stream.on('error', (err) => this.log.error(`stream: ${err.message}`));
    stream.on('close', () => this.streams.delete(stream));

    return {
      stream,
      start,
      end,
      size: file.length,
      mime: MIME[extname(file.name).toLowerCase()] ?? 'video/mp4',
    };
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private getVideoFile(torrent: Torrent): TorrentFile | undefined {
    return torrent.files
      .filter((f) => /\.(mp4|mkv|webm|avi)$/i.test(f.name))
      .sort((a, b) => b.length - a.length)[0]; // the largest video file
  }

  private whenReady(torrent: Torrent): Promise<void> {
    return new Promise((resolve, reject) => {
      if (torrent.ready) return resolve();

      const finish = (err?: Error) => {
        clearTimeout(timer);
        if (err) reject(err);
        else resolve();
      };
      const timer = setTimeout(
        () => finish(new GatewayTimeoutException('Timed out looking for this torrent (no peers?)')),
        METADATA_TIMEOUT_MS,
      );

      torrent.once('ready', () => finish());
      torrent.once('error', (e) => finish(new BadRequestException(`Torrent error: ${String(e)}`)));
      torrent.once('close', () => finish(new ConflictException('Replaced by another stream')));
    });
  }

  private badRange() {
    return new HttpException('Invalid range', HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
  }

  private async cleanupIfIdle() {
    // A torrent that is paused, or still looking for metadata, is not "idle".
    if (!this.current || this.paused || !this.current.ready) return;
    if (Date.now() - this.lastActivity > IDLE_TIMEOUT_MS) {
      this.log.log('Idle for 30 s – cleaning up');
      await this.destroyTorrent();
    }
  }
}