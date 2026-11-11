import { Module } from '@nestjs/common';
import { TorrentModule } from '../torrent/torrent.module.js';
import { VlcController } from './vlc.controller.js';
import { VlcService } from './vlc.service.js';

@Module({
  imports: [TorrentModule],
  controllers: [VlcController],
  providers: [VlcService],
})
export class VlcModule {}