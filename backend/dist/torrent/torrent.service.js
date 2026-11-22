var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var TorrentService_1;
import { BadRequestException, ConflictException, GatewayTimeoutException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, } from '@nestjs/common';
import MemoryStore from 'memory-chunk-store';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import WebTorrent from 'webtorrent';
import { IDLE_TIMEOUT_MS, METADATA_TIMEOUT_MS } from '../config.js';
const MIME = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
};
const WINDOW_BYTES = 4 * 1024 * 1024;
let TorrentService = TorrentService_1 = class TorrentService {
    log = new Logger(TorrentService_1.name);
    client = new WebTorrent();
    current = null;
    streams = new Set();
    lastActivity = Date.now();
    paused = false;
    idleTimer;
    onModuleInit() {
        this.client.on('error', (err) => this.log.error(`client error: ${String(err)}`));
        this.idleTimer = setInterval(() => void this.cleanupIfIdle(), 5000);
    }
    async onModuleDestroy() {
        clearInterval(this.idleTimer);
        await this.destroyTorrent();
        this.client.destroy();
    }
    async start(source) {
        await this.destroyTorrent();
        this.lastActivity = Date.now();
        this.paused = false;
        let torrent;
        try {
            torrent = this.client.add(source, { store: MemoryStore, deselect: true });
        }
        catch {
            throw new BadRequestException('Invalid magnet link or .torrent file');
        }
        this.current = torrent;
        torrent.on('error', (err) => this.log.warn(`torrent error: ${String(err)}`));
        try {
            await this.whenReady(torrent);
        }
        catch (err) {
            await this.destroyTorrent(torrent);
            throw err;
        }
        const video = this.getVideoFile(torrent);
        if (!video) {
            await this.destroyTorrent(torrent);
            throw new NotFoundException('No video file found in torrent');
        }
        this.paused = true;
        this.lastActivity = Date.now();
        return {
            title: video.name,
            magnet: typeof source === 'string' ? source : torrent.magnetURI,
        };
    }
    async destroyTorrent(only) {
        const torrent = this.current;
        if (!torrent || (only && only !== torrent))
            return;
        this.log.log('Destroying torrent…');
        for (const s of this.streams)
            s.destroy();
        this.streams.clear();
        this.current = null;
        this.paused = false;
        await new Promise((resolve) => {
            if (torrent.destroyed)
                return resolve();
            torrent.destroy({ destroyStore: true }, () => resolve());
        });
    }
    hasActive() {
        return this.current !== null;
    }
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
        if (!t)
            return { active: false };
        return {
            active: true,
            paused: this.paused,
            progress: (t.progress * 100).toFixed(1),
            downloadSpeed: (t.downloadSpeed / 1024 / 1024).toFixed(2),
            peers: t.numPeers,
        };
    }
    resolveRange(rangeHeader) {
        const torrent = this.current;
        if (!torrent)
            throw new BadRequestException('No active torrent');
        const file = this.getVideoFile(torrent);
        if (!file)
            throw new NotFoundException('No video file');
        const size = file.length;
        const mime = MIME[extname(file.name).toLowerCase()] ?? 'video/mp4';
        let start = 0;
        let end = size - 1;
        let partial = false;
        if (rangeHeader) {
            const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
            if (!m || (m[1] === '' && m[2] === ''))
                throw this.badRange();
            if (m[1] === '') {
                const n = Number(m[2]);
                if (n === 0)
                    throw this.badRange();
                start = Math.max(0, size - n);
            }
            else {
                start = Number(m[1]);
                if (m[2] !== '')
                    end = Math.min(Number(m[2]), size - 1);
            }
            if (start >= size || start > end)
                throw this.badRange();
            partial = true;
        }
        return { file, start, end, size, mime, partial };
    }
    openStream({ file, start, end }) {
        const torrent = this.current;
        if (!torrent)
            throw new BadRequestException('No active torrent');
        const stream = Readable.from(this.windowed(torrent, file, start, end), {
            objectMode: false,
        });
        this.streams.add(stream);
        this.lastActivity = Date.now();
        stream.on('error', (err) => this.log.error(`stream: ${err.message}`));
        stream.on('close', () => this.streams.delete(stream));
        return stream;
    }
    async *windowed(torrent, file, start, end) {
        let pos = start;
        let selected = null;
        try {
            while (pos <= end) {
                const winEnd = Math.min(pos + WINDOW_BYTES - 1, end);
                if (torrent.destroyed)
                    return;
                if (this.paused) {
                    torrent.resume();
                    this.paused = false;
                }
                const pieceLen = torrent.pieceLength;
                const lastPiece = torrent.pieces.length - 1;
                const p0 = Math.max(0, Math.floor((file.offset + pos) / pieceLen));
                const p1 = Math.min(Math.floor((file.offset + winEnd) / pieceLen) + 2, lastPiece);
                if (selected)
                    torrent.deselect(selected[0], selected[1]);
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
        }
        finally {
            if (selected && !torrent.destroyed)
                torrent.deselect(selected[0], selected[1]);
        }
    }
    getVideoFile(torrent) {
        return torrent.files
            .filter((f) => /\.(mp4|mkv|webm|avi)$/i.test(f.name))
            .sort((a, b) => b.length - a.length)[0];
    }
    whenReady(torrent) {
        return new Promise((resolve, reject) => {
            if (torrent.ready)
                return resolve();
            const finish = (err) => {
                clearTimeout(timer);
                if (err)
                    reject(err);
                else
                    resolve();
            };
            const timer = setTimeout(() => finish(new GatewayTimeoutException('Timed out looking for this torrent (no peers?)')), METADATA_TIMEOUT_MS);
            torrent.once('ready', () => finish());
            torrent.once('error', (e) => finish(new BadRequestException(`Torrent error: ${String(e)}`)));
            torrent.once('close', () => finish(new ConflictException('Replaced by another stream')));
        });
    }
    badRange() {
        return new HttpException('Invalid range', HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
    }
    async cleanupIfIdle() {
        if (!this.current || this.paused || !this.current.ready)
            return;
        if (Date.now() - this.lastActivity > IDLE_TIMEOUT_MS) {
            this.log.log('Idle for 30 s – cleaning up');
            await this.destroyTorrent();
        }
    }
};
TorrentService = TorrentService_1 = __decorate([
    Injectable()
], TorrentService);
export { TorrentService };
//# sourceMappingURL=torrent.service.js.map