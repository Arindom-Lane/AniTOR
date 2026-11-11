import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { HistoryService } from '../history/history.service.js';
import { TorrentService } from './torrent.service.js';

@Controller()
export class TorrentController {
  constructor(
    private readonly torrents: TorrentService,
    private readonly history: HistoryService,
  ) {}

  // Nest answers POST with 201 by default; the old API used 200, so we keep 200.
  @Post('stream')
  @HttpCode(200)
  async start(@Body('magnetLink') magnetLink?: string) {
    if (typeof magnetLink !== 'string' || !magnetLink.trim()) {
      throw new BadRequestException('No magnet link provided');
    }
    const magnet = magnetLink.trim();
    const title = await this.torrents.start(magnet);
    this.history.add(title, magnet);
    return { title };
  }

  @Get('video-stream')
  videoStream(@Req() req: Request, @Res() res: Response) {
    const { stream, start, end, size, mime } = this.torrents.readRange(req.headers.range);

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': mime,
      'Cache-Control': 'no-store',
    });

    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }

  @Post('pause-download')
  @HttpCode(200)
  pause() {
    this.torrents.pause();
  }

  @Post('resume-download')
  @HttpCode(200)
  resume() {
    this.torrents.resume();
  }

  @Post('stop-stream')
  @HttpCode(200)
  async stop() {
    await this.torrents.destroyTorrent();
  }

  @Get('stats')
  stats() {
    return this.torrents.stats();
  }
}