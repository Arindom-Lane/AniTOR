import { Module } from '@nestjs/common';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';

/**
 * Exported so TorrentModule can inject HistoryService directly
 * (starting a stream also writes a history entry).
 */
@Module({
  controllers: [HistoryController],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
