import { Controller, Post, Get, Body, Req, Res, HttpCode } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TorrentService } from './torrent.service';
import { StartStreamDto } from './dto/start-stream.dto';

/**
 * Every route here maps 1:1 onto a method on TorrentService —
 * this controller intentionally has no logic of its own beyond
 * request/response wiring.
 */
@Controller('api')
export class TorrentController {
  constructor(private readonly torrentService: TorrentService) {}

  @Post('stream')
  async startStream(@Body() dto: StartStreamDto) {
    return this.torrentService.startStream(dto.magnetLink);
  }

  /**
   * Uses @Res() directly (bypassing Nest's response serialization)
   * because this streams raw video bytes with manual range headers —
   * something Nest's normal "return a value, Nest sends it" flow
   * isn't built for.
   */
  @Get('video-stream')
  async streamVideo(@Req() req: Request, @Res() res: Response) {
    await this.torrentService.streamVideo(req, res);
  }

  @Post('pause-download')
  @HttpCode(200)
  pauseDownload() {
    return this.torrentService.pauseDownload();
  }

  @Post('resume-download')
  @HttpCode(200)
  resumeDownload() {
    return this.torrentService.resumeDownload();
  }

  @Post('stop-stream')
  @HttpCode(200)
  async stopStream() {
    await this.torrentService.stopStream();
    return { stopped: true };
  }

  @Get('stats')
  getStats() {
    return this.torrentService.getStats();
  }
}
