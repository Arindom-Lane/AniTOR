var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from '../config.js';
let HistoryService = class HistoryService {
    file = join(DATA_DIR, 'history.json');
    constructor() {
        mkdirSync(DATA_DIR, { recursive: true });
        if (!existsSync(this.file))
            writeFileSync(this.file, '[]');
    }
    list() {
        try {
            return JSON.parse(readFileSync(this.file, 'utf8'));
        }
        catch {
            return [];
        }
    }
    add(title, magnetLink) {
        const items = this.list().filter((i) => i.magnetLink !== magnetLink);
        items.unshift({ title, magnetLink });
        this.write(items.slice(0, 50));
    }
    remove(magnetLink) {
        this.write(this.list().filter((i) => i.magnetLink !== magnetLink));
    }
    write(items) {
        writeFileSync(this.file, JSON.stringify(items, null, 2));
    }
};
HistoryService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], HistoryService);
export { HistoryService };
//# sourceMappingURL=history.service.js.map