import { Module } from '@nestjs/common';
import { AnimeController } from './anime.controller.js';
import { AnimeService } from './anime.service.js';

@Module({
  controllers: [AnimeController],
  providers: [AnimeService],
})
export class AnimeModule {}