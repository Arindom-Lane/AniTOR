import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * Body shape for POST /api/stream.
 * The Matches rule rejects anything that isn't a magnet URI before
 * it ever reaches TorrentService — cheap, fast validation at the edge.
 */
export class StartStreamDto {
  @IsString()
  @IsNotEmpty({ message: 'magnetLink is required' })
  @Matches(/^magnet:\?/, { message: 'magnetLink must be a valid magnet URI' })
  magnetLink: string;
}
