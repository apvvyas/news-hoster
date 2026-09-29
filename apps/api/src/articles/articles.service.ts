import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service.js';
import { paginate, type Paginated } from '../common/pagination.js';
import { slugify } from '../common/text.js';
import {
  Article,
  ArticleStatus,
  ArticleTranslation,
} from './article.entity.js';
import type {
  AdminArticlesQuery,
  BulkStatusDto,
  UpdateArticleDto,
} from './articles.dto.js';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article) private readonly repo: Repository<Article>,
    @InjectRepository(ArticleTranslation)
    private readonly translations: Repository<ArticleTranslation>,
    private readonly categories: CategoriesService,
  ) {}

  async list(q: AdminArticlesQuery): Promise<Paginated<Article>> {
    const qb = this.repo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.category', 'c')
      .leftJoinAndSelect('a.translations', 't')
      .orderBy('a.publishedAt', 'DESC')
      .addOrderBy('a.id', 'DESC');
    if (q.status) qb.andWhere('a.status = :status', { status: q.status });
    if (q.categoryId) qb.andWhere('c.id = :cid', { cid: q.categoryId });
    if (q.sourceLanguage)
      qb.andWhere('a.sourceLanguage = :sl', { sl: q.sourceLanguage });
    if (q.q) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM article_translations s WHERE s."articleId" = a.id AND s.headline ILIKE :q)',
        { q: `%${q.q.replace(/[%_\\]/g, '\\$&')}%` },
      );
    }
    // Paginate on ids first so the translations join doesn't skew LIMIT.
    const [idRows, total] = await Promise.all([
      qb
        .clone()
        .select('a.id', 'id')
        .addSelect('a.publishedAt')
        .offset((q.page - 1) * q.limit)
        .limit(q.limit)
        .getRawMany<{ id: string }>(),
      qb.clone().getCount(),
    ]);
    const ids = idRows.map((r) => r.id);
    const items = ids.length
      ? await this.repo.find({ where: { id: In(ids) } })
      : [];
    items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    return paginate(items, total, q);
  }

  async get(id: string): Promise<Article> {
    const a = await this.repo.findOne({
      where: { id },
      relations: { item: true },
    });
    if (!a) throw new NotFoundException('Article not found');
    return a;
  }

  async update(id: string, dto: UpdateArticleDto): Promise<Article> {
    const a = await this.get(id);
    if (dto.status !== undefined) a.status = dto.status;
    if (dto.tags !== undefined)
      a.tags = dto.tags.map((t) => t.trim()).filter(Boolean);
    if (dto.imageUrl !== undefined) a.imageUrl = dto.imageUrl || null;
    if (dto.categoryId !== undefined)
      a.category = dto.categoryId
        ? await this.categories.get(dto.categoryId)
        : null;
    for (const t of dto.translations ?? []) {
      const existing = a.translations.find((x) => x.language === t.language);
      const keyPoints = t.keyPoints.map((p) => p.trim()).filter(Boolean);
      if (existing)
        Object.assign(existing, {
          headline: t.headline,
          summary: t.summary,
          keyPoints,
        });
      else a.translations.push(this.translations.create({ ...t, keyPoints }));
    }
    await this.repo.save(a);
    return this.get(id);
  }

  async bulkStatus(dto: BulkStatusDto): Promise<{ updated: number }> {
    const res = await this.repo.update(
      { id: In(dto.ids) },
      { status: dto.status },
    );
    return { updated: res.affected ?? 0 };
  }

  async removeTranslation(id: string, language: string): Promise<Article> {
    const a = await this.get(id);
    if (a.translations.length <= 1)
      throw new BadRequestException('An article needs at least one language');
    await this.translations.delete({ article: { id }, language });
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('Article not found');
  }

  /** A unique, readable, ASCII slug: prefers the English headline. */
  async uniqueSlug(candidates: string[]): Promise<string> {
    const base =
      candidates.map((c) => slugify(c)).find(Boolean) ||
      `story-${Date.now().toString(36)}`;
    let slug = base;
    for (let n = 2; await this.repo.existsBy({ slug }); n++)
      slug = `${base}-${n}`;
    return slug;
  }

  countByStatus(): Promise<{ status: ArticleStatus; count: string }[]> {
    return this.repo
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.status')
      .getRawMany();
  }
}
