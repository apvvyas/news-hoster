// Shapes returned by the News Hoster API. Keep in sync with apps/api.

export type Language = 'en' | 'hi';
export const LANGUAGES: Language[] = ['en', 'hi'];
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  hi: 'हिन्दी',
};

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

// ---- Public API (websites) -------------------------------------------------

export interface PublicCategory {
  slug: string;
  name: string;
}

export interface PublicArticle {
  id: string;
  slug: string;
  language: Language;
  availableLanguages: Language[];
  headline: string;
  summary: string;
  keyPoints: string[];
  category: PublicCategory | null;
  tags: string[];
  imageUrl: string | null;
  source: { name: string; url: string | null };
  publishedAt: string;
  updatedAt: string;
  seo: PublicSeo;
}

/** Everything a website needs for its <head>. */
export interface PublicSeo {
  title: string;
  description: string;
  /** Override for <link rel="canonical">; null = the article's own URL on your site. */
  canonicalUrl: string | null;
  noindex: boolean;
}

export interface PublicArticleDetail extends PublicArticle {
  /** Optional longer write-up; paragraphs separated by blank lines. */
  body: string;
  related: PublicArticle[];
}

export interface SitemapEntry {
  slug: string;
  languages: Language[];
  updatedAt: string;
}

export interface PublicSiteInfo {
  name: string;
  slug: string;
  domain: string | null;
  description: string;
  defaultLanguage: Language;
  languages: Language[];
  categories: PublicCategory[];
}

export interface PublicArticlesQuery {
  lang?: Language;
  category?: string;
  tag?: string;
  q?: string;
  page?: number;
  limit?: number;
}

// ---- Admin API ---------------------------------------------------------------

export type Role = 'admin' | 'editor';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface Category {
  id: string;
  slug: string;
  names: Partial<Record<Language, string>> & { en: string };
  sortOrder: number;
  createdAt: string;
}

export type ItemStatus =
  'pending' | 'done' | 'duplicate' | 'failed' | 'skipped';

export interface Feed {
  id: string;
  name: string;
  url: string;
  language: Language | 'auto';
  defaultCategory: Category | null;
  active: boolean;
  fetchIntervalMinutes: number;
  lastFetchedAt: string | null;
  lastError: string | null;
  createdAt: string;
  itemCounts?: Partial<Record<ItemStatus, number>>;
}

export interface FeedItem {
  id: string;
  feed: Feed;
  url: string;
  title: string;
  content: string;
  author: string | null;
  imageUrl: string | null;
  tags: string[];
  language: Language;
  publishedAt: string;
  status: ItemStatus;
  attempts: number;
  error: string | null;
  createdAt: string;
}

export type ArticleStatus = 'draft' | 'published' | 'rejected' | 'trash';

/** The editable content of one language version. */
export interface VersionContent {
  headline: string;
  summary: string;
  keyPoints: string[];
  body: string;
  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
}

export interface ArticleTranslation extends VersionContent {
  id?: string;
  language: Language;
}

export interface ArticleRevision {
  id: string;
  language: Language;
  content: VersionContent;
  author: User | null;
  note: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  language: Language;
  role: 'user' | 'assistant';
  content: string;
  proposal: VersionContent | null;
  appliedRevisionId: string | null;
  author: User | null;
  createdAt: string;
}

export interface Article {
  id: string;
  slug: string;
  sourceLanguage: Language;
  category: Category | null;
  tags: string[];
  imageUrl: string | null;
  sourceName: string;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  status: ArticleStatus;
  engine: string;
  publishedAt: string;
  translations: ArticleTranslation[];
  item?: FeedItem | null;
  createdAt: string;
  updatedAt: string;
}

export interface Site {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  description: string;
  defaultLanguage: Language;
  languages: Language[];
  categories: Category[];
  apiKeyPrefix: string;
  active: boolean;
  createdAt: string;
}

export interface SiteWithKey {
  site: Site;
  /** Shown once — store it in the website's configuration. */
  apiKey: string;
}

export type RestructureEngine = 'auto' | 'sarvam' | 'extractive';

export interface Settings {
  autoPublish: boolean;
  engine: RestructureEngine;
  targetLanguages: Language[];
  batchSize: number;
  effectiveEngine: Exclude<RestructureEngine, 'auto'>;
  sarvamConfigured: boolean;
  sarvamModel: string;
  updatedAt: string;
}

export interface FetchResult {
  feedId: string;
  feedName: string;
  status: 'ok' | 'not-modified' | 'error';
  new: number;
  duplicate: number;
  seen: number;
  error?: string;
}

export interface PipelineRun {
  startedAt: string;
  finishedAt: string;
  fetch: FetchResult[];
  restructure: {
    engine: string;
    done: number;
    failed: number;
    stoppedEarly?: string;
  } | null;
  skipped?: string;
}

export interface Dashboard {
  articles: Partial<Record<ArticleStatus, number>>;
  items: Partial<Record<ItemStatus, number>>;
  feeds: {
    total: number;
    active: number;
    failing: { id: string; name: string; lastError: string }[];
  };
  sites: number;
  settings: Settings;
  pipeline: { running: boolean; lastRun: PipelineRun | null };
}

// ---- Admin inputs --------------------------------------------------------------

export interface FeedInput {
  name: string;
  url: string;
  language?: Language | 'auto';
  defaultCategoryId?: string | null;
  active?: boolean;
  fetchIntervalMinutes?: number;
}

export interface CategoryInput {
  slug: string;
  names: Partial<Record<Language, string>> & { en: string };
  sortOrder?: number;
}

export interface SiteInput {
  name: string;
  slug: string;
  domain?: string | null;
  description?: string;
  defaultLanguage: Language;
  languages: Language[];
  categoryIds?: string[];
  active?: boolean;
}

export interface UserInput {
  email: string;
  name: string;
  password: string;
  role: Role;
}

export interface TranslationInput extends Partial<
  Omit<VersionContent, 'headline' | 'summary' | 'keyPoints'>
> {
  language: Language;
  headline: string;
  summary: string;
  keyPoints: string[];
}

export interface ArticleUpdate {
  slug?: string;
  canonicalUrl?: string | null;
  noindex?: boolean;
  status?: ArticleStatus;
  categoryId?: string | null;
  tags?: string[];
  imageUrl?: string | null;
  translations?: TranslationInput[];
}

export interface AdminArticlesQuery {
  status?: ArticleStatus;
  categoryId?: string;
  sourceLanguage?: Language;
  q?: string;
  page?: number;
  limit?: number;
}

export interface ItemsQuery {
  status?: ItemStatus;
  feedId?: string;
  page?: number;
  limit?: number;
}
