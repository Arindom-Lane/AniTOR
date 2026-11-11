import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AnimeService } from './anime.service.js';

@Controller('anime-info')
export class AnimeController {
  constructor(private readonly anime: AnimeService) {}

  // We use @Res() here on purpose: when there is no result the old API sent the
  // JSON text "null", but Nest would send an empty body for a returned null,
  // and the frontend's response.json() would then throw.
  @Get()
  async info(@Query('title') title: string | undefined, @Res() res: Response) {
    res.json(title ? await this.anime.lookup(title) : null);
  }
}