import { BadRequestException, Controller, HttpCode, Post } from '@nestjs/common';
import { PORT } from '../config.js';
import { TorrentService } from '../torrent/torrent.service.js';
import { VlcService } from './vlc.service.js';

@Controller('open-vlc')
export class VlcController {
  constructor(
    private readonly vlc: VlcService,
    private readonly torrents: TorrentService,
  ) {}

  @Post()
  @HttpCode(200)
  async open() {
    if (!this.torrents.hasActive()) throw new BadRequestException('No active stream');
    await this.vlc.open(`http://127.0.0.1:${PORT}/api/video-stream`);
  }
}