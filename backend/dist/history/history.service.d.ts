export interface HistoryItem {
    title: string;
    magnetLink: string;
}
export declare class HistoryService {
    private readonly file;
    constructor();
    list(): HistoryItem[];
    add(title: string, magnetLink: string): void;
    remove(magnetLink: string): void;
    private write;
}
