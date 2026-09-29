import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import { Article, ArticleStatus } from '../articles/article.entity.js';
import { ArticlesService } from '../articles/articles.service.js';
import { Category } from '../categories/category.entity.js';
import { APP_CONFIG, type AppConfig } from '../config/configuration.js';
import { FeedItem, ItemStatus } from '../feeds/feed-item.entity.js';
import { Feed } from '../feeds/feed.entity.js';
import { RestructureEngine } from '../settings/settings.entity.js';
import { SettingsService } from '../settings/settings.service.js';
import { ExtractiveRestructurer } from './extractive.restructurer.js';
import { FetcherService, type FetchResult } from './fetcher.service.js';
import {
  FatalRestructureError,
  TransientRestructureError,
  type Restructurer,
} from './restructurer.js';
import { SarvamRestructurer } from './sarvam.restructurer.js';

export const MAX_ATTEMPTS = 3;
const LOCK_KEY = 'news-hoster:pipeline';

export interface RestructureSummary {
  engine: string;
  done: number;
  failed: number;
  stoppedEarly?: string;
}

export interface PipelineRun {
  startedAt: Date;
  finishedAt: Date;
  fetch: FetchResult[];
  restructure: RestructureSummary | null;
  skipped?: string;
}

/** Factory seam so tests can inject a fake Sarvam client. */
export const RESTRUCTURER_FACTORY = Symbol('RESTRUCTURER_FACTORY');
export type RestructurerFactory = (
  engine: Exclude<RestructureEngine, RestructureEngine.Auto>,
) => Restructurer;

@Injectable()
export class PipelineService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly log = new Logger(PipelineService.name);
  private running = false;
  lastRun: PipelineRun | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(RESTRUCTURER_FACTORY)
    private readonly makeRestructurer: RestructurerFactory,
    @InjectRepository(Feed) private readonly feeds: Repository<Feed>,
    @InjectRepository(FeedItem) private readonly items: Repository<FeedItem>,
    @InjectRepository(Article) private readonly articles: Repository<Article>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    private readonly articlesService: ArticlesService,
    private readonly fetcher: FetcherService,
    private readonly settings: SettingsService,
    private readonly dataSource: DataSource,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onApplicationBootstrap() {
    const minutes = this.config.pipelineIntervalMinutes;
    if (minutes <= 0) {
      this.log.log('Scheduled pipeline disabled (PIPELINE_INTERVAL_MINUTES=0)');
      return;
    }
    const handle = setInterval(
      () => void this.run().catch((e) => this.log.error(e)),
      minutes * 60_000,
    );
    this.scheduler.addInterval('pipeline', handle);
    this.log.log(`Pipeline scheduled every ${minutes} min`);
  }

  onModuleDestroy() {
    if (this.scheduler.doesExist('interval', 'pipeline'))
      this.scheduler.deleteInterval('pipeline');
  }

  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Fetch due feeds (or the given ones) and restructure a batch of pending stories.
   * Guarded by a Postgres advisory lock so several API instances never overlap.
   */
  async run(
    opts: { feedIds?: string[]; fetch?: boolean; restructure?: boolean } = {},
  ): Promise<PipelineRun> {
    const startedAt = new Date();
    if (this.running)
      return this.record({
        startedAt,
        finishedAt: new Date(),
        fetch: [],
        restructure: null,
        skipped: 'already running',
      });
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    this.running = true;
    try {
      const [{ locked }] = await runner.query(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
        [LOCK_KEY],
      );
      if (!locked)
        return this.record({
          startedAt,
          finishedAt: new Date(),
          fetch: [],
          restructure: null,
          skipped: 'another instance is running',
        });
      try {
        const fetch: FetchResult[] = [];
        if (opts.fetch !== false) {
          const feeds = opts.feedIds
            ? await this.feeds.findBy(opts.feedIds.map((id) => ({ id })))
            : await this.fetcher.dueFeeds();
          for (const feed of feeds)
            fetch.push(await this.fetcher.fetchFeed(feed));
        }
        const restructure =
          opts.restructure === false ? null : await this.restructureBatch();
        return this.record({
          startedAt,
          finishedAt: new Date(),
          fetch,
          restructure,
        });
      } finally {
        await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [
          LOCK_KEY,
        ]);
      }
    } finally {
      this.running = false;
      await runner.release();
    }
  }

  private record(run: PipelineRun): PipelineRun {
    this.lastRun = run;
    return run;
  }

  async restructureBatch(): Promise<RestructureSummary> {
    const settings = await this.settings.get();
    const engine = this.settings.effectiveEngine(settings);
    const restructurer = this.makeRestructurer(engine);
    const summary: RestructureSummary = {
      engine: restructurer.name,
      done: 0,
      failed: 0,
    };

    const categories = await this.categories.find({
      order: { sortOrder: 'ASC' },
    });
    if (!categories.length) {
      summary.stoppedEarly = 'no categories defined';
      return summary;
    }
    const pending = await this.items.find({
      where: { status: ItemStatus.Pending, attempts: LessThan(MAX_ATTEMPTS) },
      order: { publishedAt: 'DESC' },
      take: settings.batchSize,
    });

    for (const item of pending) {
      try {
        const result = await restructurer.restructure({
          title: item.title,
          content: item.content,
          sourceName: item.feed.name,
          sourceLanguage: item.language,
          publishedAt: item.publishedAt,
          categoryHint: item.feed.defaultCategory?.slug ?? null,
          categories: categories.map((c) => ({
            slug: c.slug,
            name: c.names.en,
          })),
          targetLanguages: settings.targetLanguages,
        });
        const byLang = new Map(result.translations.map((t) => [t.language, t]));
        const article = this.articles.create({
          slug: await this.articlesService.uniqueSlug([
            byLang.get('en')?.headline ?? '',
            item.title,
          ]),
          item,
          sourceLanguage: item.language,
          category:
            categories.find((c) => c.slug === result.categorySlug) ??
            item.feed.defaultCategory ??
            null,
          tags: result.tags.length ? result.tags : item.tags.slice(0, 5),
          imageUrl: item.imageUrl,
          sourceName: item.feed.name,
          sourceUrl: item.url,
          status: settings.autoPublish
            ? ArticleStatus.Published
            : ArticleStatus.Draft,
          engine: result.engine,
          publishedAt: item.publishedAt,
          translations: result.translations.map((t) => ({ ...t })),
        });
        await this.dataSource.transaction(async (m) => {
          await m.save(article);
          await m.update(FeedItem, item.id, {
            status: ItemStatus.Done,
            error: null,
          });
        });
        summary.done++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          err instanceof TransientRestructureError ||
          err instanceof FatalRestructureError
        ) {
          // Don't burn attempts on problems that aren't the story's fault.
          summary.stoppedEarly = message;
          this.log.warn(`Restructuring stopped: ${message}`);
          break;
        }
        const attempts = item.attempts + 1;
        await this.items.update(item.id, {
          attempts,
          error: message.slice(0, 1000),
          status:
            attempts >= MAX_ATTEMPTS ? ItemStatus.Failed : ItemStatus.Pending,
        });
        summary.failed++;
        this.log.warn(`Could not restructure "${item.title}": ${message}`);
      }
    }
    if (summary.done || summary.failed)
      this.log.log(
        `Restructured ${summary.done}, failed ${summary.failed} (${summary.engine})`,
      );
    return summary;
  }
}

export function defaultRestructurerFactory(
  config: AppConfig,
): RestructurerFactory {
  return (engine) => {
    if (engine === RestructureEngine.Sarvam) {
      if (!config.sarvam.apiKey)
        throw new FatalRestructureError(
          'Engine is "sarvam" but SARVAM_API_KEY is not set',
        );
      return SarvamRestructurer.create(
        config.sarvam.apiKey,
        config.sarvam.model,
        config.sarvam.baseUrl,
      );
    }
    return new ExtractiveRestructurer();
  };
}
