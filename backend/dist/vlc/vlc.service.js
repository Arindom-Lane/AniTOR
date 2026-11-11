var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
let VlcService = class VlcService {
    open(url) {
        const [cmd, args] = this.command(url);
        return new Promise((resolve, reject) => {
            const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
            child.on('error', (err) => reject(new InternalServerErrorException(`Could not start VLC: ${err.message}`)));
            child.on('spawn', () => {
                child.unref();
                resolve();
            });
        });
    }
    command(url) {
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
};
VlcService = __decorate([
    Injectable()
], VlcService);
export { VlcService };
//# sourceMappingURL=vlc.service.js.map