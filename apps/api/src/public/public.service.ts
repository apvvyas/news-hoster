import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { Article, ArticleStatus } from '../articles/article.entity.js';
import { Category } from '../categories/category.entity.js';
import { Site } from '../sites/site.entity.js';
import type {
  PublicArticle,
  PublicArticleDetail,
  PublicArticlePage,
  PublicArticlesQuery,
  PublicCategory,
  PublicSiteInfo,
  SitemapEntry,
} from './public.dto.js';

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(Article) private readonly articles: Repository<Article>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  resolveLang(site: Site, lang?: string): string {
    if (!lang) return site.defaultLanguage;
    if (!site.languages.includes(lang))
      throw new BadRequestException(
        `This site does not serve language "${lang}"`,
      );
    return lang;
  }

  async siteCategories(site: Site): Promise<Category[]> {
    if (site.categories.length)
      return [...site.categories].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug),
      );
    return this.categories.find({ order: { sortOrder: 'ASC', slug: 'ASC' } });
  }

  presentCategory(c: Category, lang: string): PublicCategory {
    return { slug: c.slug, name: c.names[lang] ?? c.names.en };
  }

  async siteInfo(site: Site, lang: string): Promise<PublicSiteInfo> {
    return {
      name: site.name,
      slug: site.slug,
      domain: site.domain,
      description: site.description,
      defaultLanguage: site.defaultLanguage,
      languages: site.languages,
      categories: (await this.siteCategories(site)).map((c) =>
        this.presentCategory(c, lang),
      ),
    };
  }

  present(a: Article, lang: string): PublicArticle {
    const t =
      a.translations.find((x) => x.language === lang) ?? a.translations[0];
    return {
      id: a.id,
      slug: a.slug,
      language: t.language,
      availableLanguages: a.translations.map((x) => x.language).sort(),
      headline: t.headline,
      summary: t.summary,
      keyPoints: t.keyPoints,
      category: a.category ? this.presentCategory(a.category, lang) : null,
      tags: a.tags,
      imageUrl: a.imageUrl,
      source: { name: a.sourceName, url: a.sourceUrl },
      publishedAt: a.publishedAt,
      updatedAt: a.updatedAt,
      seo: {
        title: t.seoTitle || t.headline,
        description: t.metaDescription || t.summary,
        canonicalUrl: a.canonicalUrl,
        noindex: a.noindex,
      },
    };
  }

  /** Published articles visible on this site that exist in `lang`. */
  private visible(site: Site, lang: string): SelectQueryBuilder<Article> {
    const qb = this.articles
      .createQueryBuilder('a')
      .leftJoin('a.category', 'c')
      .where('a.status = :published', { published: ArticleStatus.Published })
      .andWhere(
        'EXISTS (SELECT 1 FROM article_translations lt WHERE lt."articleId" = a.id AND lt.language = :lang)',
        { lang },
      );
    if (site.categories.length)
      qb.andWhere('c.id IN (:...siteCats)', {
        siteCats: site.categories.map((c) => c.id),
      });
    return qb;
  }

  async list(site: Site, q: PublicArticlesQuery): Promise<PublicArticlePage> {
    const lang = this.resolveLang(site, q.lang);
    const qb = this.visible(site, lang);
    if (q.category) qb.andWhere('c.slug = :cat', { cat: q.category });
    if (q.tag)
      qb.andWhere('a.tags @> :tag::jsonb', {
        tag: JSON.stringify([q.tag.toLowerCase()]),
      });
    if (q.q) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM article_translations st WHERE st."articleId" = a.id AND st.language = :lang AND st.headline ILIKE :q)',
        {
          q: `%${q.q.replace(/[%_\\]/g, '\\$&')}%`,
        },
      );
    }
    const total = await qb.getCount();
    const rows = await qb
      .select(['a.id', 'a.publishedAt'])
      .orderBy('a.publishedAt', 'DESC')
      .addOrderBy('a.id', 'DESC')
      .offset((q.page - 1) * q.limit)
      .limit(q.limit)
      .getMany();
    return {
      items: await this.load(
        rows.map((r) => r.id),
        lang,
      ),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  async detail(
    site: Site,
    slug: string,
    langParam?: string,
  ): Promise<PublicArticleDetail> {
    const lang = this.resolveLang(site, langParam);
    const hit = await this.visible(site, lang)
      .andWhere('a.slug = :slug', { slug })
      .select(['a.id'])
      .getOne();
    if (!hit) throw new NotFoundException('Article not found');
    const full = await this.articles.findOneByOrFail({ id: hit.id });
    const article = {
      ...this.present(full, lang),
      body: (
        full.translations.find((t) => t.language === lang) ??
        full.translations[0]
      ).body,
    };
    let related: PublicArticle[] = [];
    if (article.category) {
      const rel = await this.visible(site, lang)
        .andWhere('c.slug = :cat AND a.id != :id', {
          cat: article.category.slug,
          id: article.id,
        })
        .select(['a.id', 'a.publishedAt'])
        .orderBy('a.publishedAt', 'DESC')
        .limit(5)
        .getMany();
      related = await this.load(
        rel.map((r) => r.id),
        lang,
      );
    }
    return { ...article, related };
  }

  /** Everything indexable on this site, for the site's sitemap.xml. */
  async sitemap(site: Site, langParam?: string): Promise<SitemapEntry[]> {
    const lang = this.resolveLang(site, langParam);
    const rows = await this.visible(site, lang)
      .andWhere('a.noindex = false')
      .leftJoinAndSelect('a.translations', 'tr')
      .orderBy('a.publishedAt', 'DESC')
      .take(5000)
      .getMany();
    return rows.map((a) => ({
      slug: a.slug,
      languages: a.translations
        .map((t) => t.language)
        .filter((l) => site.languages.includes(l))
        .sort(),
      updatedAt: a.updatedAt,
    }));
  }

  private async load(ids: string[], lang: string): Promise<PublicArticle[]> {
    if (!ids.length) return [];
    const found = await this.articles.find({ where: { id: In(ids) } });
    const byId = new Map(found.map((a) => [a.id, a]));
    return ids.map((id) => this.present(byId.get(id)!, lang));
  }
}
