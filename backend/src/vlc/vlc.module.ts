import { Module } from '@nestjs/common';
import { VlcController } from './vlc.controller';
import { VlcService } from './vlc.service';

@Module({
  controllers: [VlcController],
  providers: [VlcService],
})
export class VlcModule {}
