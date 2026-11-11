import { TorrentService } from '../torrent/torrent.service.js';
import { VlcService } from './vlc.service.js';
export declare class VlcController {
    private readonly vlc;
    private readonly torrents;
    constructor(vlc: VlcService, torrents: TorrentService);
    open(): Promise<void>;
}
