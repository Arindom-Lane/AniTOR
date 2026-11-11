import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

@Injectable()
export class VlcService {
  open(url: string): Promise<void> {
    const [cmd, args] = this.command(url);

    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
      child.on('error', (err) =>
        reject(new InternalServerErrorException(`Could not start VLC: ${err.message}`)),
      );
      child.on('spawn', () => {
        child.unref(); // VLC keeps running even if AniTOR closes
        resolve();
      });
    });
  }

  private command(url: string): [string, string[]] {
    switch (process.platform) {
      case 'win32': {
        const candidates = [
          join(process.env['ProgramFiles'] ?? 'C:\\Program Files', 'VideoLAN', 'VLC', 'vlc.exe'),
          join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'VideoLAN', 'VLC', 'vlc.exe'),
        ];
        return [candidates.find((p) => existsSync(p)) ?? 'vlc', [url]];
      }
      case 'darwin':
        return ['open', ['-a', 'VLC', url]];
      default:
        return ['vlc', [url]];
    }
  }
}