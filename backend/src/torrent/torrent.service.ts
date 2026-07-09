import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

import { HistoryService } from '../history/history.service';
import { TorrentStats } from './interfaces/torrent-stats.interface';

// Optional in-memory chunk store. When installed, torrent pieces live
// entirely in RAM and are freed the instant the torrent is removed —
// this is the same trick real streaming/CDN edge caches use to avoid
// wearing out SSDs on data that's only needed transiently. If it isn't
// installed, we fall back to disk-backed storage automatically.
//
// require() (not import) is used deliberately here: it's the only way
// to make this dependency truly optional — a top-level `import` would
// throw at module-load time if the package isn't installed, whereas
// require() inside try/catch lets us detect that and fall back cleanly.
let MemoryStore: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  MemoryStore = require('memory-chunk-store');
} catch {
  // Not installed — fine, we just use disk storage instead.
}

// webtorrent (v2+) publishes as ESM-only and uses top-level await
// internally, which a synchronous require() cannot load at all —
// Node throws ERR_REQUIRE_ASYNC_MODULE. A plain `import` statement
// doesn't work either: TypeScript compiles this project to CommonJS,
// and by default it down-levels `import()` to a require() call under
// the hood, hitting the exact same error.
//
// The fix is to force a *genuine* native dynamic import, bypassing
// TypeScript's down-leveling entirely. Wrapping import() in `new
// Function(...)` hides it from the compiler, so it's emitted exactly
// as written and Node handles it as real ESM loading at runtime.
// WebTorrent is loaded once, lazily, in onModuleInit() below.
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<any>;

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.avi'];

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
};

@Injectable()
export class TorrentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TorrentService.name);

  private client: any;
  private currentTorrent: any = null;
  private currentStream: any = null;

  /** True while the browser player is paused — download is halted. */
  private isPaused = false;

  /** Bumped on every streamed chunk; drives the idle-cleanup timer. */
  private lastActivity = Date.now();

  private readonly cacheDir: string;
  private readonly useMemoryStore: boolean;
  private readonly idleTimeoutMs: number;
  private readonly pieceWindowBytes: number;
  private idleCheckHandle: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly historyService: HistoryService,
  ) {
    this.cacheDir = path.join(process.cwd(), this.config.get<string>('cacheDir')!);
    this.useMemoryStore = this.config.get<boolean>('useMemoryStore')! && !!MemoryStore;
    this.idleTimeoutMs = this.config.get<number>('idleTimeoutMs')!;
    this.pieceWindowBytes = this.config.get<number>('pieceWindowBytes')!;

    if (!this.useMemoryStore && !fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    this.logger.log(
      this.useMemoryStore
        ? 'Storage mode: RAM (memory-chunk-store) — zero SSD writes'
        : 'Storage mode: disk (temp_cache/) — install memory-chunk-store to avoid SSD writes',
    );
  }

  async onModuleInit() {
    const { default: WebTorrent } = await dynamicImport('webtorrent');
    this.client = new WebTorrent();

    // Only tear down a torrent for being "idle" if it's genuinely
    // abandoned. A paused player is a deliberate user action, not
    // idleness, so it's explicitly excluded from this check.
    this.idleCheckHandle = setInterval(() => {
      if (!this.currentTorrent || this.isPaused) return;

      const idleFor = Date.now() - this.lastActivity;
      if (idleFor > this.idleTimeoutMs) {
        this.logger.log(`Idle for ${Math.round(idleFor / 1000)}s — cleaning up torrent`);
        this.destroyTorrent();
      }
    }, this.config.get<number>('idleCheckIntervalMs'));
  }

  onModuleDestroy() {
    clearInterval(this.idleCheckHandle);
    this.destroyTorrent();
  }

  // =====================================================
  // PUBLIC API — one method per REST endpoint
  // =====================================================

  /**
   * Add a magnet link, locate its video file, and record it in
   * history. Any previous torrent is torn down first — this is
   * also what guarantees old cached data never lingers when a
   * new magnet link is pasted in.
   */
  async startStream(magnetLink: string): Promise<{ title: string }> {
    await this.destroyTorrent();

    const addOptions = this.useMemoryStore
      ? { store: MemoryStore }
      : { path: path.join(this.cacheDir, Date.now().toString()) };

    return new Promise((resolve, reject) => {
      this.client.add(magnetLink, addOptions, (torrent: any) => {
        this.currentTorrent = torrent;
        this.isPaused = false;
        this.lastActivity = Date.now();

        const video = this.getVideoFile(torrent);
        if (!video) {
          this.destroyTorrent();
          reject(new NotFoundException('No playable video file found in this torrent'));
          return;
        }

        // Don't download anything yet. The video-stream endpoint
        // below selects only the byte range the player actually
        // asks for, the moment it asks for it.
        torrent.pause();
        this.isPaused = true;

        this.historyService.add(video.name, magnetLink);

        resolve({ title: video.name });
      });
    });
  }

  /**
   * Serve a byte-range chunk of the current video, selecting only
   * the torrent pieces needed for that chunk. This — plus pause/resume
   * below — is the core of "don't download the whole file" streaming.
   */
  async streamVideo(req: Request, res: Response): Promise<void> {
    if (!this.currentTorrent) {
      throw new BadRequestException('No active torrent');
    }

    const file = this.getVideoFile(this.currentTorrent);
    if (!file) {
      throw new NotFoundException('No video file in torrent');
    }

    const range = req.headers.range;
    if (!range) {
      throw new BadRequestException('Range header is required for video streaming');
    }

    const [rawStart, rawEnd] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(rawStart, 10);
    const end = rawEnd
      ? parseInt(rawEnd, 10)
      : Math.min(start + this.pieceWindowBytes, file.length - 1);
    const chunkSize = end - start + 1;

    this.selectPieceWindow(start, end);

    // A range request is playback activity by definition — resume
    // downloading if we were paused.
    if (this.isPaused) {
      this.currentTorrent.resume();
      this.isPaused = false;
    }

    const mimeType = MIME_TYPES[path.extname(file.name).toLowerCase()] || 'video/mp4';

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${file.length}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType,
      'Cache-Control': 'no-store',
    });

    this.lastActivity = Date.now();

    const stream = file.createReadStream({ start, end });
    this.currentStream = stream;

    stream.on('data', () => {
      this.lastActivity = Date.now();
    });
    stream.on('error', (err: Error) => this.logger.error(`Stream error: ${err.message}`));
    stream.on('close', () => {
      this.currentStream = null;
    });

    res.on('close', () => {
      try {
        stream.destroy();
      } catch {
        // stream may already be closed — safe to ignore
      }
      this.currentStream = null;
    });

    stream.pipe(res);
  }

  /**
   * Halt downloading. Called when the browser player is paused.
   * The torrent itself is left intact so playback can resume
   * instantly, without re-fetching metadata or re-connecting peers.
   */
  pauseDownload(): { paused: boolean } {
    if (this.currentTorrent && !this.isPaused) {
      this.currentTorrent.pause();
      this.isPaused = true;
      this.logger.log('Download paused');
    }
    return { paused: this.isPaused };
  }

  /** Resume downloading after a pause. */
  resumeDownload(): { paused: boolean } {
    if (this.currentTorrent && this.isPaused) {
      this.currentTorrent.resume();
      this.isPaused = false;
      this.logger.log('Download resumed');
    }
    return { paused: this.isPaused };
  }

  /** Full teardown — called on page unload/refresh or when a new magnet link starts. */
  async stopStream(): Promise<void> {
    await this.destroyTorrent();
  }

  getStats(): TorrentStats {
    if (!this.currentTorrent) {
      return { active: false };
    }

    return {
      active: true,
      paused: this.isPaused,
      progress: (this.currentTorrent.progress * 100).toFixed(1),
      downloadSpeed: (this.currentTorrent.downloadSpeed / 1024 / 1024).toFixed(2),
      peers: this.currentTorrent.numPeers,
    };
  }

  // =====================================================
  // INTERNAL HELPERS
  // =====================================================

  /** Pick the largest video file in the torrent (the main episode/movie, not samples/extras). */
  private getVideoFile(torrent: any) {
    return torrent.files
      .filter((f: any) => VIDEO_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext)))
      .sort((a: any, b: any) => b.length - a.length)[0];
  }

  /**
   * Narrow the torrent's piece selection down to just the window
   * needed for the requested byte range (plus a couple of pieces
   * ahead, for smooth playback). Everything outside that window is
   * deselected so WebTorrent stops fetching pieces the player will
   * never use — this is what keeps bandwidth and disk/RAM usage low,
   * instead of greedily downloading the entire file in the background.
   */
  private selectPieceWindow(start: number, end: number): void {
    const torrent = this.currentTorrent;
    const pieceLength = torrent.pieceLength;
    const maxPiece = torrent.pieces.length - 1;

    const startPiece = Math.max(0, Math.floor(start / pieceLength));
    const endPiece = Math.min(Math.floor(end / pieceLength) + 2, maxPiece);

    torrent.deselect(0, maxPiece, false); // clear everything
    torrent.select(startPiece, endPiece, true); // ...then only what we need now
  }

  /** Remove the current torrent from the client and wipe its cache folder (disk mode only). */
  private async destroyTorrent(): Promise<void> {
    if (!this.currentTorrent) return;

    const torrent = this.currentTorrent;
    const folderToClean = this.useMemoryStore ? null : torrent.path;

    try {
      this.currentStream?.destroy();
    } catch {
      // stream may already be closed
    }
    this.currentStream = null;

    await new Promise<void>((resolve) => {
      this.client.remove(torrent.infoHash, { destroyStore: true }, () => {
        if (folderToClean && fs.existsSync(folderToClean)) {
          try {
            fs.rmSync(folderToClean, { recursive: true, force: true });
          } catch (err) {
            this.logger.warn(`Could not remove cache folder: ${(err as Error).message}`);
          }
        }
        resolve();
      });
    });

    this.currentTorrent = null;
    this.isPaused = false;
  }
}
