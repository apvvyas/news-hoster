import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticlesModule } from '../articles/articles.module.js';
import { Category } from '../categories/category.entity.js';
import { APP_CONFIG } from '../config/configuration.js';
import { FeedItem } from '../feeds/feed-item.entity.js';
import { Feed } from '../feeds/feed.entity.js';
import { SettingsModule } from '../settings/settings.module.js';
import { Site } from '../sites/site.entity.js';
import { DashboardService } from './dashboard.service.js';
import { FetcherService } from './fetcher.service.js';
import { PipelineController } from './pipeline.controller.js';
import {
  defaultRestructurerFactory,
  PipelineService,
  RESTRUCTURER_FACTORY,
} from './pipeline.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Feed, FeedItem, Category, Site]),
    ArticlesModule,
    SettingsModule,
  ],
  controllers: [PipelineController],
  providers: [
    FetcherService,
    PipelineService,
    DashboardService,
    {
      provide: RESTRUCTURER_FACTORY,
      inject: [APP_CONFIG],
      useFactory: defaultRestructurerFactory,
    },
  ],
  exports: [PipelineService, FetcherService],
})
export class PipelineModule {}
