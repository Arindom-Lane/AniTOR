import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Query shape for DELETE /api/history?magnetLink=...
 * We identify entries by magnet link (not an index or id) since
 * that's the only stable unique key history.json actually has.
 */
export class DeleteHistoryDto {
  @IsString()
  @IsNotEmpty({ message: 'magnetLink is required' })
  magnetLink: string;
}
