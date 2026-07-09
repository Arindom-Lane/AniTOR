import { Module } from '@nestjs/common';
import { AnimeInfoController } from './anime-info.controller';
import { AnimeInfoService } from './anime-info.service';

@Module({
  controllers: [AnimeInfoController],
  providers: [AnimeInfoService],
})
export class AnimeInfoModule {}
