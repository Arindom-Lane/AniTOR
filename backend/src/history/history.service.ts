import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { HistoryItem } from './interfaces/history-item.interface';

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);
  private readonly historyFilePath: string;
  private readonly maxEntries = 50;

  constructor(private readonly config: ConfigService) {
    this.historyFilePath = path.join(process.cwd(), this.config.get<string>('historyFile')!);

    if (!fs.existsSync(this.historyFilePath)) {
      fs.writeFileSync(this.historyFilePath, '[]');
    }
  }

  findAll(): HistoryItem[] {
    try {
      const raw = fs.readFileSync(this.historyFilePath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      this.logger.warn(`Could not read history file: ${(err as Error).message}`);
      return [];
    }
  }

  private writeAll(items: HistoryItem[]): void {
    fs.writeFileSync(this.historyFilePath, JSON.stringify(items, null, 2));
  }

  /**
   * Add a new entry to the front of the list. Any existing entry
   * with the same magnet link is removed first, so re-streaming the
   * same torrent bumps it to the top instead of creating a duplicate.
   * The list is capped at `maxEntries` so history.json can't grow
   * without bound.
   */
  add(title: string, magnetLink: string): void {
    const items = this.findAll().filter((i) => i.magnetLink !== magnetLink);
    items.unshift({ title, magnetLink });

    if (items.length > this.maxEntries) {
      items.length = this.maxEntries;
    }

    this.writeAll(items);
  }

  remove(magnetLink: string): void {
    const items = this.findAll().filter((i) => i.magnetLink !== magnetLink);
    this.writeAll(items);
  }
}
