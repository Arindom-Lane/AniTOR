import { Controller, Get, Delete, Query, HttpCode } from '@nestjs/common';
import { HistoryService } from './history.service';
import { DeleteHistoryDto } from './dto/delete-history.dto';

@Controller('api/history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  findAll() {
    return this.historyService.findAll();
  }

  @Delete()
  @HttpCode(200)
  remove(@Query() dto: DeleteHistoryDto) {
    this.historyService.remove(dto.magnetLink);
    return { removed: true };
  }
}
