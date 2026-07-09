import { Module } from '@nestjs/common';
import { TorrentController } from './torrent.controller';
import { TorrentService } from './torrent.service';
import { HistoryModule } from '../history/history.module';

/**
 * Imports HistoryModule because starting a stream also records
 * it in history — rather than duplicate that file I/O here, we
 * reuse HistoryService directly.
 */
@Module({
  imports: [HistoryModule],
  controllers: [TorrentController],
  providers: [TorrentService],
  exports: [TorrentService],
})
export class TorrentModule {}
