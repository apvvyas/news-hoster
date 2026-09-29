import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArticlesService } from '../articles/articles.service.js';
import { FeedItem } from '../feeds/feed-item.entity.js';
import { Feed } from '../feeds/feed.entity.js';
import { Site } from '../sites/site.entity.js';
import {
  SettingsService,
  type SettingsView,
} from '../settings/settings.service.js';
import { PipelineService, type PipelineRun } from './pipeline.service.js';

export interface Dashboard {
  articles: Record<string, number>;
  items: Record<string, number>;
  feeds: {
    total: number;
    active: number;
    failing: { id: string; name: string; lastError: string }[];
  };
  sites: number;
  settings: SettingsView;
  pipeline: { running: boolean; lastRun: PipelineRun | null };
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Feed) private readonly feeds: Repository<Feed>,
    @InjectRepository(FeedItem) private readonly items: Repository<FeedItem>,
    @InjectRepository(Site) private readonly sites: Repository<Site>,
    private readonly articles: ArticlesService,
    private readonly settings: SettingsService,
    private readonly pipeline: PipelineService,
  ) {}

  async get(): Promise<Dashboard> {
    const [articleRows, itemRows, feeds, sites, settings] = await Promise.all([
      this.articles.countByStatus(),
      this.items
        .createQueryBuilder('i')
        .select('i.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('i.status')
        .getRawMany<{ status: string; count: string }>(),
      this.feeds.find(),
      this.sites.count(),
      this.settings.view(),
    ]);
    const toRecord = (rows: { status: string; count: string }[]) =>
      Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
    return {
      articles: toRecord(articleRows),
      items: toRecord(itemRows),
      feeds: {
        total: feeds.length,
        active: feeds.filter((f) => f.active).length,
        failing: feeds
          .filter((f) => f.active && f.lastError)
          .map((f) => ({ id: f.id, name: f.name, lastError: f.lastError! })),
      },
      sites,
      settings,
      pipeline: {
        running: this.pipeline.isRunning,
        lastRun: this.pipeline.lastRun,
      },
    };
  }
}
