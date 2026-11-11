import { HistoryService } from './history.service.js';
export declare class HistoryController {
    private readonly history;
    constructor(history: HistoryService);
    list(): import("./history.service.js").HistoryItem[];
    remove(magnetLink?: string): void;
}
