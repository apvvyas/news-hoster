import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../categories/category.entity.js';
import { FeedItem } from '../feeds/feed-item.entity.js';

export enum ArticleStatus {
  Draft = 'draft',
  Published = 'published',
  Rejected = 'rejected',
  Trash = 'trash',
}

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  /** The feed item this article was restructured from (null for hand-written articles). */
  @OneToOne(() => FeedItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  item: FeedItem | null;

  @Column()
  sourceLanguage: string;

  @ManyToOne(() => Category, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  category: Category | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags: string[];

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column()
  sourceName: string;

  @Column({ type: 'varchar', nullable: true })
  sourceUrl: string | null;

  @Index()
  @Column({ type: 'enum', enum: ArticleStatus, default: ArticleStatus.Draft })
  status: ArticleStatus;

  /** Which engine produced it, e.g. 'sarvam:sarvam-105b', 'extractive', 'manual'. */
  @Column()
  engine: string;

  /** When the story broke (from the source). */
  @Index()
  @Column({ type: 'timestamptz' })
  publishedAt: Date;

  /** SEO: overrides the canonical URL (defaults to the article's own page on each site). */
  @Column({ type: 'varchar', nullable: true })
  canonicalUrl: string | null;

  /** SEO: ask search engines not to index this article. */
  @Column({ default: false })
  noindex: boolean;

  @OneToMany(() => ArticleTranslation, (t) => t.article, {
    cascade: true,
    eager: true,
  })
  translations: ArticleTranslation[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('article_translations')
@Unique(['article', 'language'])
export class ArticleTranslation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Article, (a) => a.translations, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  article: Article;

  @Column()
  language: string;

  @Column()
  headline: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  keyPoints: string[];

  /** Optional longer write-up (plain paragraphs separated by blank lines). */
  @Column({ type: 'text', default: '' })
  body: string;

  /** SEO title (<title>); falls back to the headline. */
  @Column({ type: 'varchar', default: '' })
  seoTitle: string;

  /** SEO meta description; falls back to the summary. */
  @Column({ type: 'varchar', default: '' })
  metaDescription: string;

  /** The keyphrase this version should rank for (drives the SEO checks in the admin). */
  @Column({ type: 'varchar', default: '' })
  focusKeyword: string;
}

/** The editable content of one language version (what revisions and chat proposals hold). */
export interface VersionContent {
  headline: string;
  summary: string;
  keyPoints: string[];
  body: string;
  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
}

export const VERSION_FIELDS: (keyof VersionContent)[] = [
  'headline',
  'summary',
  'keyPoints',
  'body',
  'seoTitle',
  'metaDescription',
  'focusKeyword',
];

export function versionContent(t: VersionContent): VersionContent {
  return {
    headline: t.headline,
    summary: t.summary,
    keyPoints: [...t.keyPoints],
    body: t.body ?? '',
    seoTitle: t.seoTitle ?? '',
    metaDescription: t.metaDescription ?? '',
    focusKeyword: t.focusKeyword ?? '',
  };
}
