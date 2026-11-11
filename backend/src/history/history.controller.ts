import { BadRequestException, Body, Controller, Delete, Get } from '@nestjs/common';
import { HistoryService } from './history.service.js';

@Controller('history')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get()
  list() {
    return this.history.list();
  }

  @Delete()
  remove(@Body('magnetLink') magnetLink?: string) {
    if (!magnetLink) throw new BadRequestException('magnetLink required');
    this.history.remove(magnetLink);
  }
}