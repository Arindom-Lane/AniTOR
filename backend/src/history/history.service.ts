import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from '../config.js';

export interface HistoryItem {
  title: string;
  magnetLink: string;
}

@Injectable()
export class HistoryService {
  private readonly file = join(DATA_DIR, 'history.json');

  constructor() {
    mkdirSync(DATA_DIR, { recursive: true });
    if (!existsSync(this.file)) writeFileSync(this.file, '[]');
  }

  list(): HistoryItem[] {
    try {
      return JSON.parse(readFileSync(this.file, 'utf8')) as HistoryItem[];
    } catch {
      return []; // missing or corrupted file -> start fresh
    }
  }

  add(title: string, magnetLink: string): void {
    const items = this.list().filter((i) => i.magnetLink !== magnetLink);
    items.unshift({ title, magnetLink });
    this.write(items.slice(0, 50)); // keep the newest 50
  }

  remove(magnetLink: string): void {
    this.write(this.list().filter((i) => i.magnetLink !== magnetLink));
  }

  private write(items: HistoryItem[]): void {
    writeFileSync(this.file, JSON.stringify(items, null, 2));
  }
}