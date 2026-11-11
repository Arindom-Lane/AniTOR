import { Module } from '@nestjs/common';
import { HistoryController } from './history.controller.js';
import { HistoryService } from './history.service.js';

@Module({
  controllers: [HistoryController],
  providers: [HistoryService],
  exports: [HistoryService], // TorrentModule saves to history, so it needs this
})
export class HistoryModule {}