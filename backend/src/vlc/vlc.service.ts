import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import * as fs from 'fs';

@Injectable()
export class VlcService {
  private readonly logger = new Logger(VlcService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Launch VLC pointed at the live HTTP stream. This is necessarily
   * platform-specific — there's no cross-platform "open with this
   * app" API in Node, so we build the right shell command per OS.
   */
  open(streamUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd = this.buildCommand(streamUrl);

      exec(cmd, (err) => {
        if (err) {
          this.logger.warn(`Could not launch VLC: ${err.message}`);
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  private buildCommand(streamUrl: string): string {
    const customPath = this.config.get<string>('vlcPath');

    if (process.platform === 'win32') {
      const vlcPath = customPath || 'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe';
      return fs.existsSync(vlcPath)
        ? `start "" "${vlcPath}" "${streamUrl}"`
        : `start "" vlc "${streamUrl}"`; // fall back to PATH
    }

    if (process.platform === 'darwin') {
      return customPath ? `"${customPath}" "${streamUrl}"` : `open -a VLC "${streamUrl}"`;
    }

    // Linux and everything else — assume vlc is on PATH unless overridden.
    return customPath ? `"${customPath}" "${streamUrl}"` : `vlc "${streamUrl}"`;
  }
}
