import { Module } from '@nestjs/common';
import { AnimeModule } from './anime/anime.module.js';
import { HistoryModule } from './history/history.module.js';
import { TorrentModule } from './torrent/torrent.module.js';
import { VlcModule } from './vlc/vlc.module.js';

@Module({
  imports: [HistoryModule, AnimeModule, TorrentModule, VlcModule],
})
export class AppModule {}