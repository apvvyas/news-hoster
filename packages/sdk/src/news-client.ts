import { createHttp } from './http.js';
import type {
  Language,
  Page,
  PublicArticle,
  PublicArticleDetail,
  PublicArticlesQuery,
  PublicCategory,
  PublicSiteInfo,
  SitemapEntry,
} from './types.js';

export interface NewsClientOptions {
  /** API origin, e.g. "https://api.example.com". */
  baseUrl: string;
  /** The site's API key from Admin → Sites. */
  apiKey: string;
  /** Default language for every call (falls back to the site's default). */
  lang?: Language;
  fetch?: typeof fetch;
}

/**
 * Read-only client for the public websites.
 *
 * ```ts
 * const news = createNewsClient({ baseUrl: 'https://api.example.com', apiKey: import.meta.env.VITE_SITE_KEY });
 * const { items } = await news.articles({ category: 'sports', limit: 10 });
 * ```
 */
export function createNewsClient(opts: NewsClientOptions) {
  const request = createHttp({
    baseUrl: opts.baseUrl,
    fetch: opts.fetch,
    headers: () => ({ 'x-api-key': opts.apiKey }),
  });
  const lang = (l?: Language) => l ?? opts.lang;

  return {
    site: (l?: Language) =>
      request<PublicSiteInfo>('GET', '/public/site', {
        query: { lang: lang(l) },
      }),
    categories: (l?: Language) =>
      request<PublicCategory[]>('GET', '/public/categories', {
        query: { lang: lang(l) },
      }),
    articles: (q: PublicArticlesQuery = {}) =>
      request<Page<PublicArticle>>('GET', '/public/articles', {
        query: { ...q, lang: lang(q.lang) },
      }),
    article: (slug: string, l?: Language) =>
      request<PublicArticleDetail>(
        'GET',
        `/public/articles/${encodeURIComponent(slug)}`,
        { query: { lang: lang(l) } },
      ),
    /** Indexable articles, for building sitemap.xml. */
    sitemap: (l?: Language) =>
      request<SitemapEntry[]>('GET', '/public/sitemap', {
        query: { lang: lang(l) },
      }),
  };
}

export type NewsClient = ReturnType<typeof createNewsClient>;
