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

const MAX_TORRENT_FILE_BYTES = 8 * 1024 * 1024; // real .torrent files are far smaller

@Controller()
export class TorrentController {
  constructor(
    private readonly torrents: TorrentService,
    private readonly history: HistoryService,
  ) {}

  // Nest answers POST with 201 by default; the old API used 200, so we keep 200.
  // Body: { magnetLink: "magnet:?..." }  or  { torrentFile: "<base64 of a .torrent file>" }
  @Post('stream')
  @HttpCode(200)
  async start(@Body() body?: { magnetLink?: unknown; torrentFile?: unknown }) {
    let source: string | Buffer;

    if (typeof body?.torrentFile === 'string' && body.torrentFile) {
      source = Buffer.from(body.torrentFile, 'base64');
      if (source.length === 0 || source.length > MAX_TORRENT_FILE_BYTES) {
        throw new BadRequestException('Invalid .torrent file');
      }
    } else if (typeof body?.magnetLink === 'string' && body.magnetLink.trim()) {
      source = body.magnetLink.trim();
    } else {
      throw new BadRequestException('No magnet link or .torrent file provided');
    }

    const { title, magnet } = await this.torrents.start(source);
    this.history.add(title, magnet);
    return { title };
  }

  @Get('video-stream')
  videoStream(@Req() req: Request, @Res() res: Response) {
    const range = this.torrents.resolveRange(req.headers.range);
    const { start, end, size, mime, partial } = range;

    // WebKit (Tauri on Linux) opens with a plain GET without any Range header,
    // so that must be answered with a normal 200. Ranges get a proper 206.
    res.writeHead(partial ? 206 : 200, {
      ...(partial ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': mime,
      'Cache-Control': 'no-store',
    });

    if (req.method === 'HEAD') return void res.end();

    const stream = this.torrents.openStream(range);
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
