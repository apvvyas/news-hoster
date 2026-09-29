import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LANGUAGES } from '../common/languages.js';
import { PaginationQuery } from '../common/pagination.js';
import { ItemStatus } from './feed-item.entity.js';

export class CreateFeedDto {
  @ApiProperty({ example: 'BBC World' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'https://feeds.bbci.co.uk/news/world/rss.xml' })
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  url: string;

  @ApiPropertyOptional({ enum: ['auto', ...LANGUAGES], default: 'auto' })
  @IsOptional()
  @IsIn(['auto', ...LANGUAGES])
  language?: string;

  @ApiPropertyOptional({
    description: 'Category hint for stories from this feed',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  defaultCategoryId?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: 30, minimum: 5, maximum: 1440 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  fetchIntervalMinutes?: number;
}

export class UpdateFeedDto extends PartialType(CreateFeedDto) {}

export class ItemsQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: ItemStatus })
  @IsOptional()
  @IsIn(Object.values(ItemStatus))
  status?: ItemStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  feedId?: string;
}
