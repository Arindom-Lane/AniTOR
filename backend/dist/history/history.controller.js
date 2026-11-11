var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { BadRequestException, Body, Controller, Delete, Get } from '@nestjs/common';
import { HistoryService } from './history.service.js';
let HistoryController = class HistoryController {
    history;
    constructor(history) {
        this.history = history;
    }
    list() {
        return this.history.list();
    }
    remove(magnetLink) {
        if (!magnetLink)
            throw new BadRequestException('magnetLink required');
        this.history.remove(magnetLink);
    }
};
__decorate([
    Get(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HistoryController.prototype, "list", null);
__decorate([
    Delete(),
    __param(0, Body('magnetLink')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], HistoryController.prototype, "remove", null);
HistoryController = __decorate([
    Controller('history'),
    __metadata("design:paramtypes", [HistoryService])
], HistoryController);
export { HistoryController };
//# sourceMappingURL=history.controller.js.map