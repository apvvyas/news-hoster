import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../categories/categories.module.js';
import { FeedItem } from './feed-item.entity.js';
import { Feed } from './feed.entity.js';
import { FeedsController } from './feeds.controller.js';
import { FeedsService } from './feeds.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Feed, FeedItem]), CategoriesModule],
  controllers: [FeedsController],
  providers: [FeedsService],
  exports: [FeedsService],
})
export class FeedsModule {}
