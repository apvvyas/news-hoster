import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from '../articles/article.entity.js';
import { Category } from '../categories/category.entity.js';
import { SitesModule } from '../sites/sites.module.js';
import { PublicController } from './public.controller.js';
import { PublicService } from './public.service.js';
import { SiteKeyGuard } from './site-key.guard.js';

@Module({
  imports: [TypeOrmModule.forFeature([Article, Category]), SitesModule],
  controllers: [PublicController],
  providers: [PublicService, SiteKeyGuard],
})
export class PublicModule {}
