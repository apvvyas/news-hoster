import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminAuth } from '../auth/auth.decorators.js';
import type { Paginated } from '../common/pagination.js';
import { FeedItem } from './feed-item.entity.js';
import { Feed } from './feed.entity.js';
import { CreateFeedDto, ItemsQuery, UpdateFeedDto } from './feeds.dto.js';
import { FeedsService, type FeedWithStats } from './feeds.service.js';

@ApiTags('admin: feeds')
@Controller('admin')
@AdminAuth()
export class FeedsController {
  constructor(private readonly feeds: FeedsService) {}

  @Get('feeds')
  list(): Promise<FeedWithStats[]> {
    return this.feeds.list();
  }

  @Post('feeds')
  create(@Body() dto: CreateFeedDto): Promise<Feed> {
    return this.feeds.create(dto);
  }

  @Patch('feeds/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeedDto,
  ): Promise<Feed> {
    return this.feeds.update(id, dto);
  }

  @Delete('feeds/:id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.feeds.remove(id);
  }

  /** The raw ingest queue: what came in from feeds and what happened to it. */
  @Get('items')
  items(@Query() q: ItemsQuery): Promise<Paginated<FeedItem>> {
    return this.feeds.listItems(q);
  }

  @Post('items/:id/retry')
  retry(@Param('id', ParseUUIDPipe) id: string): Promise<FeedItem> {
    return this.feeds.retryItem(id);
  }
}
