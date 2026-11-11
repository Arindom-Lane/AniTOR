import { Module } from '@nestjs/common';
import { HistoryModule } from '../history/history.module.js';
import { TorrentController } from './torrent.controller.js';
import { TorrentService } from './torrent.service.js';

@Module({
  imports: [HistoryModule],
  controllers: [TorrentController],
  providers: [TorrentService],
  exports: [TorrentService], // VlcModule needs to know if a stream is active
})
export class TorrentModule {}