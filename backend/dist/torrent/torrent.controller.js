var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { BadRequestException, Body, Controller, Get, HttpCode, Post, Req, Res, } from '@nestjs/common';
import { HistoryService } from '../history/history.service.js';
import { TorrentService } from './torrent.service.js';
const MAX_TORRENT_FILE_BYTES = 8 * 1024 * 1024;
let TorrentController = class TorrentController {
    torrents;
    history;
    constructor(torrents, history) {
        this.torrents = torrents;
        this.history = history;
    }
    async start(body) {
        let source;
        if (typeof body?.torrentFile === 'string' && body.torrentFile) {
            source = Buffer.from(body.torrentFile, 'base64');
            if (source.length === 0 || source.length > MAX_TORRENT_FILE_BYTES) {
                throw new BadRequestException('Invalid .torrent file');
            }
        }
        else if (typeof body?.magnetLink === 'string' && body.magnetLink.trim()) {
            source = body.magnetLink.trim();
        }
        else {
            throw new BadRequestException('No magnet link or .torrent file provided');
        }
        const { title, magnet } = await this.torrents.start(source);
        this.history.add(title, magnet);
        return { title };
    }
    videoStream(req, res) {
        const range = this.torrents.resolveRange(req.headers.range);
        const { start, end, size, mime, partial } = range;
        res.writeHead(partial ? 206 : 200, {
            ...(partial ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
            'Content-Type': mime,
            'Cache-Control': 'no-store',
        });
        if (req.method === 'HEAD')
            return void res.end();
        const stream = this.torrents.openStream(range);
        res.on('close', () => stream.destroy());
        stream.pipe(res);
    }
    pause() {
        this.torrents.pause();
    }
    resume() {
        this.torrents.resume();
    }
    async stop() {
        await this.torrents.destroyTorrent();
    }
    stats() {
        return this.torrents.stats();
    }
};
__decorate([
    Post('stream'),
    HttpCode(200),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TorrentController.prototype, "start", null);
__decorate([
    Get('video-stream'),
    __param(0, Req()),
    __param(1, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TorrentController.prototype, "videoStream", null);
__decorate([
    Post('pause-download'),
    HttpCode(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TorrentController.prototype, "pause", null);
__decorate([
    Post('resume-download'),
    HttpCode(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TorrentController.prototype, "resume", null);
__decorate([
    Post('stop-stream'),
    HttpCode(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TorrentController.prototype, "stop", null);
__decorate([
    Get('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TorrentController.prototype, "stats", null);
TorrentController = __decorate([
    Controller(),
    __metadata("design:paramtypes", [TorrentService,
        HistoryService])
], TorrentController);
export { TorrentController };
//# sourceMappingURL=torrent.controller.js.map