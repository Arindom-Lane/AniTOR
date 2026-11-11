var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BadRequestException, Controller, HttpCode, Post } from '@nestjs/common';
import { PORT } from '../config.js';
import { TorrentService } from '../torrent/torrent.service.js';
import { VlcService } from './vlc.service.js';
let VlcController = class VlcController {
    vlc;
    torrents;
    constructor(vlc, torrents) {
        this.vlc = vlc;
        this.torrents = torrents;
    }
    async open() {
        if (!this.torrents.hasActive())
            throw new BadRequestException('No active stream');
        await this.vlc.open(`http://127.0.0.1:${PORT}/api/video-stream`);
    }
};
__decorate([
    Post(),
    HttpCode(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VlcController.prototype, "open", null);
VlcController = __decorate([
    Controller('open-vlc'),
    __metadata("design:paramtypes", [VlcService,
        TorrentService])
], VlcController);
export { VlcController };
//# sourceMappingURL=vlc.controller.js.map