import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';

import { TorrentModule } from './torrent/torrent.module';
import { HistoryModule } from './history/history.module';
import { AnimeInfoModule } from './anime-info/anime-info.module';
import { VlcModule } from './vlc/vlc.module';

/**
 * Root module. Wires together the four feature modules that
 * replace the old single server.js file:
 *
 *   torrent      -> WebTorrent client, range streaming, pause/resume
 *   history      -> reads/writes history.json
 *   anime-info   -> MyAnimeList lookups via the Jikan API
 *   vlc          -> launches VLC pointed at the live stream
 *
 * ConfigModule is global so every service can inject ConfigService
 * instead of reading process.env directly.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TorrentModule,
    HistoryModule,
    AnimeInfoModule,
    VlcModule,
  ],
})
export class AppModule {}
