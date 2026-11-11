import type { Response } from 'express';
import { AnimeService } from './anime.service.js';
export declare class AnimeController {
    private readonly anime;
    constructor(anime: AnimeService);
    info(title: string | undefined, res: Response): Promise<void>;
}
