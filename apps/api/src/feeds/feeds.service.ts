import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type FindOptionsWhere, Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service.js';
import { paginate, type Paginated } from '../common/pagination.js';
import { FeedItem, ItemStatus } from './feed-item.entity.js';
import { Feed } from './feed.entity.js';
import type { CreateFeedDto, ItemsQuery, UpdateFeedDto } from './feeds.dto.js';

export interface FeedWithStats extends Feed {
  itemCounts: Partial<Record<ItemStatus, number>>;
}

@Injectable()
export class FeedsService {
  constructor(
    @InjectRepository(Feed) private readonly feeds: Repository<Feed>,
    @InjectRepository(FeedItem) private readonly items: Repository<FeedItem>,
    private readonly categories: CategoriesService,
  ) {}

  async list(): Promise<FeedWithStats[]> {
    const feeds = await this.feeds.find({ order: { name: 'ASC' } });
    const rows: { feedId: string; status: ItemStatus; count: string }[] =
      await this.items
        .createQueryBuilder('i')
        .select('i.feedId', 'feedId')
        .addSelect('i.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('i.feedId')
        .addGroupBy('i.status')
        .getRawMany();
    return feeds.map((f) => ({
      ...f,
      itemCounts: Object.fromEntries(
        rows
          .filter((r) => r.feedId === f.id)
          .map((r) => [r.status, Number(r.count)]),
      ),
    }));
  }

  async get(id: string): Promise<Feed> {
    const feed = await this.feeds.findOneBy({ id });
    if (!feed) throw new NotFoundException('Feed not found');
    return feed;
  }

  async create(dto: CreateFeedDto): Promise<Feed> {
    if (await this.feeds.existsBy({ url: dto.url }))
      throw new ConflictException('This feed URL is already registered');
    const feed = this.feeds.create({
      name: dto.name,
      url: dto.url,
      language: dto.language ?? 'auto',
      active: dto.active ?? true,
      fetchIntervalMinutes: dto.fetchIntervalMinutes ?? 30,
      defaultCategory: dto.defaultCategoryId
        ? await this.categories.get(dto.defaultCategoryId)
        : null,
    });
    return this.feeds.save(feed);
  }

  async update(id: string, dto: UpdateFeedDto): Promise<Feed> {
    const feed = await this.get(id);
    if (dto.url && dto.url !== feed.url) {
      if (await this.feeds.existsBy({ url: dto.url }))
        throw new ConflictException('This feed URL is already registered');
      feed.url = dto.url;
      feed.etag = feed.lastModified = null;
    }
    if (dto.name !== undefined) feed.name = dto.name;
    if (dto.language !== undefined) feed.language = dto.language;
    if (dto.active !== undefined) feed.active = dto.active;
    if (dto.fetchIntervalMinutes !== undefined)
      feed.fetchIntervalMinutes = dto.fetchIntervalMinutes;
    if (dto.defaultCategoryId !== undefined) {
      feed.defaultCategory = dto.defaultCategoryId
        ? await this.categories.get(dto.defaultCategoryId)
        : null;
    }
    return this.feeds.save(feed);
  }

  async remove(id: string): Promise<void> {
    const res = await this.feeds.delete(id);
    if (!res.affected) throw new NotFoundException('Feed not found');
  }

  async listItems(q: ItemsQuery): Promise<Paginated<FeedItem>> {
    // TypeORM 1.x rejects `undefined` in where clauses, so only add the filters that are set.
    const where: FindOptionsWhere<FeedItem> = {};
    if (q.status) where.status = q.status;
    if (q.feedId) where.feed = { id: q.feedId };
    const [items, total] = await this.items.findAndCount({
      where,
      order: { publishedAt: 'DESC' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  /** Put a failed/skipped item back in the queue. */
  async retryItem(id: string): Promise<FeedItem> {
    const item = await this.items.findOneBy({ id });
    if (!item) throw new NotFoundException('Item not found');
    if (item.status === ItemStatus.Done)
      throw new ConflictException('Item was already restructured');
    item.status = ItemStatus.Pending;
    item.attempts = 0;
    item.error = null;
    return this.items.save(item);
  }
}
