import { Controller, Get, Query } from '@nestjs/common';
import { AnimeInfoService } from './anime-info.service';

@Controller('api/anime-info')
export class AnimeInfoController {
  constructor(private readonly animeInfoService: AnimeInfoService) {}

  /**
   * `title` is the raw torrent filename (e.g. "[Group] Show - 01.mkv").
   * Returns null (not a 404) when nothing is found — an unmatched
   * lookup isn't an error, it's just "no info to show".
   */
  @Get()
  async getInfo(@Query('title') title?: string) {
    if (!title) return null;
    return this.animeInfoService.fetchInfo(title);
  }
}
