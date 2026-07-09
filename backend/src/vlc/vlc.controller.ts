import { Controller, Post, HttpCode, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VlcService } from './vlc.service';

@Controller('api/open-vlc')
export class VlcController {
  constructor(
    private readonly vlcService: VlcService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  async open() {
    // Deliberately localhost:PORT, not the frontend's dev-server
    // origin — VLC is a desktop app making its own HTTP request
    // directly to this API, not something routed through Vite's proxy.
    const port = this.config.get('port');
    const streamUrl = `http://localhost:${port}/api/video-stream`;

    try {
      await this.vlcService.open(streamUrl);
      return { opened: true };
    } catch {
      throw new ServiceUnavailableException(
        'Could not open VLC. Make sure it is installed and on your PATH (or set VLC_PATH in .env).',
      );
    }
  }
}
