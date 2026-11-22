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
import { Readable } from 'node:stream';
import WebTorrent from 'webtorrent';
import type { Torrent, TorrentFile } from 'webtorrent';
import { IDLE_TIMEOUT_MS, METADATA_TIMEOUT_MS } from '../config.js';

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
};

export interface StartedTorrent {
  title: string;
  magnet: string;
}

export interface StreamRange {
  file: TorrentFile;
  start: number;
  end: number; // inclusive
  size: number;
  mime: string;
  partial: boolean; // true -> answer 206, false -> answer 200
}

// The player may ask for the whole rest of the file, but we only ever let
// WebTorrent work on one window of this size at a time (RAM friendly).
const WINDOW_BYTES = 4 * 1024 * 1024;

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
    this.client.on('error', (err) =>
      this.log.error(`client error: ${String(err)}`),
    );
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

  /**
   * Adds a magnet link (string) or the contents of a .torrent file (Buffer),
   * waits for metadata, and returns the video's name plus a magnet link that
   * can be saved in the history.
   */
  async start(source: string | Buffer): Promise<StartedTorrent> {
    await this.destroyTorrent();
    this.lastActivity = Date.now();
    this.paused = false;

    let torrent: Torrent;
    try {
      // MemoryStore = pieces live in RAM, nothing is written to your SSD.
      // deselect = start with NO pieces selected. Without it WebTorrent begins
      // downloading the whole episode the moment it knows what the files are.
      torrent = this.client.add(source, { store: MemoryStore, deselect: true });
    } catch {
      throw new BadRequestException('Invalid magnet link or .torrent file');
    }
    this.current = torrent;
    torrent.on('error', (err) =>
      this.log.warn(`torrent error: ${String(err)}`),
    );

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

    // "paused" here only means "nothing is being fetched yet" (deselect: true keeps
    // it idle until the player asks for data). We deliberately do NOT call
    // torrent.pause(): WebTorrent destroys every peer that connects while paused,
    // and a .torrent file has no metadata phase to connect peers beforehand.
    this.paused = true;
    this.lastActivity = Date.now();
    // for a magnet link keep exactly what the user gave us; for a .torrent file
    // WebTorrent builds an equivalent magnet link for the history
    return {
      title: video.name,
      magnet: typeof source === 'string' ? source : torrent.magnetURI,
    };
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

  /** Works out which bytes the player wants. No Range header = the whole file. */
  resolveRange(rangeHeader?: string): StreamRange {
    const torrent = this.current;
    if (!torrent) throw new BadRequestException('No active torrent');
    const file = this.getVideoFile(torrent);
    if (!file) throw new NotFoundException('No video file');

    const size = file.length;
    const mime = MIME[extname(file.name).toLowerCase()] ?? 'video/mp4';
    let start = 0;
    let end = size - 1;
    let partial = false;

    if (rangeHeader) {
      // bytes=a-b | bytes=a- | bytes=-n (last n bytes)
      const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (!m || (m[1] === '' && m[2] === '')) throw this.badRange();
      if (m[1] === '') {
        const n = Number(m[2]);
        if (n === 0) throw this.badRange();
        start = Math.max(0, size - n);
      } else {
        start = Number(m[1]);
        if (m[2] !== '') end = Math.min(Number(m[2]), size - 1);
      }
      if (start >= size || start > end) throw this.badRange();
      partial = true;
    }
    return { file, start, end, size, mime, partial };
  }

  /** Opens the byte stream for a resolved range. */
  openStream({ file, start, end }: StreamRange): Readable {
    const torrent = this.current;
    if (!torrent) throw new BadRequestException('No active torrent');

    const stream = Readable.from(this.windowed(torrent, file, start, end), {
      objectMode: false,
    });
    this.streams.add(stream);
    this.lastActivity = Date.now();

    stream.on('error', (err) => this.log.error(`stream: ${err.message}`));
    stream.on('close', () => this.streams.delete(stream));
    return stream;
  }

  /**
   * Yields start..end (inclusive) one window at a time. The player sees one
   * long response, but WebTorrent only ever gets asked for a small piece
   * range, so we never start downloading the whole episode.
   */
  private async *windowed(
    torrent: Torrent,
    file: TorrentFile,
    start: number,
    end: number,
  ): AsyncGenerator<Uint8Array> {
    let pos = start;
    let selected: [number, number] | null = null;

    try {
      while (pos <= end) {
        const winEnd = Math.min(pos + WINDOW_BYTES - 1, end);

        if (torrent.destroyed) return;
        if (this.paused) {
          torrent.resume();
          this.paused = false;
        }
        const pieceLen = torrent.pieceLength;
        const lastPiece = torrent.pieces.length - 1;
        const p0 = Math.max(0, Math.floor((file.offset + pos) / pieceLen));
        const p1 = Math.min(
          Math.floor((file.offset + winEnd) / pieceLen) + 2,
          lastPiece,
        );

        // drop our own previous window, then ask only for what playback needs now
        if (selected) torrent.deselect(selected[0], selected[1]);
        torrent.select(p0, p1, true);
        selected = [p0, p1];

        for await (const chunk of file.createReadStream({
          start: pos,
          end: winEnd,
        })) {
          this.lastActivity = Date.now();
          yield chunk;
        }
        pos = winEnd + 1;
      }
    } finally {
      if (selected && !torrent.destroyed)
        torrent.deselect(selected[0], selected[1]);
    }
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
        () =>
          finish(
            new GatewayTimeoutException(
              'Timed out looking for this torrent (no peers?)',
            ),
          ),
        METADATA_TIMEOUT_MS,
      );

      torrent.once('ready', () => finish());
      torrent.once('error', (e) =>
        finish(new BadRequestException(`Torrent error: ${String(e)}`)),
      );
      torrent.once('close', () =>
        finish(new ConflictException('Replaced by another stream')),
      );
    });
  }

  private badRange() {
    return new HttpException(
      'Invalid range',
      HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
    );
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
