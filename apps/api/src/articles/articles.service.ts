import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service.js';
import { paginate, type Paginated } from '../common/pagination.js';
import { slugify } from '../common/text.js';
import {
  Article,
  ArticleStatus,
  ArticleTranslation,
  VERSION_FIELDS,
  versionContent,
} from './article.entity.js';
import type {
  AdminArticlesQuery,
  BulkStatusDto,
  UpdateArticleDto,
} from './articles.dto.js';
import { RevisionsService } from './revisions.service.js';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article) private readonly repo: Repository<Article>,
    @InjectRepository(ArticleTranslation)
    private readonly translations: Repository<ArticleTranslation>,
    private readonly categories: CategoriesService,
    private readonly revisions: RevisionsService,
    private readonly dataSource: DataSource,
  ) {}

  async list(q: AdminArticlesQuery): Promise<Paginated<Article>> {
    const qb = this.repo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.category', 'c')
      .leftJoinAndSelect('a.translations', 't')
      .orderBy('a.publishedAt', 'DESC')
      .addOrderBy('a.id', 'DESC');
    // Like WordPress, "All" excludes the trash.
    if (q.status) qb.andWhere('a.status = :status', { status: q.status });
    else qb.andWhere('a.status != :trash', { trash: ArticleStatus.Trash });
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

  translation(a: Article, language: string): ArticleTranslation {
    const t = a.translations.find((x) => x.language === language);
    if (!t)
      throw new NotFoundException(`This article has no "${language}" version`);
    return t;
  }

  async update(
    id: string,
    dto: UpdateArticleDto,
    userId: string | null,
  ): Promise<Article> {
    const a = await this.get(id);
    if (dto.slug !== undefined && dto.slug !== a.slug) {
      if (await this.repo.existsBy({ slug: dto.slug }))
        throw new ConflictException('Slug already in use');
      a.slug = dto.slug;
    }
    if (dto.status !== undefined) a.status = dto.status;
    if (dto.tags !== undefined)
      a.tags = [
        ...new Set(dto.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)),
      ];
    if (dto.imageUrl !== undefined) a.imageUrl = dto.imageUrl || null;
    if (dto.canonicalUrl !== undefined)
      a.canonicalUrl = dto.canonicalUrl || null;
    if (dto.noindex !== undefined) a.noindex = dto.noindex;
    if (dto.categoryId !== undefined)
      a.category = dto.categoryId
        ? await this.categories.get(dto.categoryId)
        : null;

    const changed: ArticleTranslation[] = [];
    for (const t of dto.translations ?? []) {
      const incoming = {
        headline: t.headline.trim(),
        summary: t.summary.trim(),
        keyPoints: t.keyPoints.map((p) => p.trim()).filter(Boolean),
        ...(t.body !== undefined && { body: t.body.trim() }),
        ...(t.seoTitle !== undefined && { seoTitle: t.seoTitle.trim() }),
        ...(t.metaDescription !== undefined && {
          metaDescription: t.metaDescription.trim(),
        }),
        ...(t.focusKeyword !== undefined && {
          focusKeyword: t.focusKeyword.trim(),
        }),
      };
      let existing = a.translations.find((x) => x.language === t.language);
      if (!existing) {
        existing = this.translations.create({
          language: t.language,
          body: '',
          seoTitle: '',
          metaDescription: '',
          focusKeyword: '',
          ...incoming,
        });
        a.translations.push(existing);
        changed.push(existing);
        continue;
      }
      const before = JSON.stringify(versionContent(existing));
      Object.assign(existing, incoming);
      if (JSON.stringify(versionContent(existing)) !== before)
        changed.push(existing);
    }

    await this.dataSource.transaction(async (m) => {
      await m.save(a);
      for (const t of changed)
        await this.revisions.snapshot(a, t, 'Edited', userId, m);
    });
    return this.get(id);
  }

  /** Restore a revision into its language version (itself recorded as a new revision). */
  async restoreRevision(
    id: string,
    revisionId: string,
    userId: string,
  ): Promise<Article> {
    const a = await this.get(id);
    const rev = await this.revisions.get(id, revisionId);
    let t = a.translations.find((x) => x.language === rev.language);
    if (!t) {
      t = this.translations.create({ language: rev.language });
      a.translations.push(t);
    }
    for (const field of VERSION_FIELDS)
      (t as unknown as Record<string, unknown>)[field] = rev.content[field];
    const target = t;
    await this.dataSource.transaction(async (m) => {
      await m.save(a);
      await this.revisions.snapshot(
        a,
        target,
        `Restored revision from ${rev.createdAt.toISOString()}`,
        userId,
        m,
      );
    });
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

  /** Permanent delete — only from the trash, like WordPress. */
  async remove(id: string): Promise<void> {
    const a = await this.repo.findOneBy({ id });
    if (!a) throw new NotFoundException('Article not found');
    if (a.status !== ArticleStatus.Trash)
      throw new ConflictException(
        'Move the article to the trash before deleting it permanently',
      );
    await this.repo.delete(id);
  }

  /** Counts for the status links above the list ("All (12) | Published (9) | …"). */
  async statusCounts(): Promise<Record<string, number>> {
    const rows = await this.countByStatus();
    const counts: Record<string, number> = Object.fromEntries(
      Object.values(ArticleStatus).map((s) => [s, 0]),
    );
    for (const r of rows) counts[r.status] = Number(r.count);
    counts.all = Object.entries(counts).reduce(
      (n, [k, v]) => (k === ArticleStatus.Trash ? n : n + v),
      0,
    );
    return counts;
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
