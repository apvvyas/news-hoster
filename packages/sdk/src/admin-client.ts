import { createHttp } from './http.js';
import type {
  AdminArticlesQuery,
  Article,
  ArticleStatus,
  ArticleRevision,
  ArticleUpdate,
  ChatMessage,
  Category,
  CategoryInput,
  Dashboard,
  Feed,
  FeedInput,
  FeedItem,
  ItemsQuery,
  Language,
  LoginResponse,
  Page,
  PipelineRun,
  Settings,
  Site,
  SiteInput,
  SiteWithKey,
  User,
  UserInput,
} from './types.js';

export interface AdminClientOptions {
  baseUrl: string;
  /** Returns the current bearer token, if signed in. */
  getToken: () => string | null;
  /** Called on any 401 (e.g. expired token). */
  onUnauthorized?: () => void;
  fetch?: typeof fetch;
}

export function createAdminClient(opts: AdminClientOptions) {
  const request = createHttp({
    baseUrl: opts.baseUrl,
    fetch: opts.fetch,
    onUnauthorized: opts.onUnauthorized,
    headers: (): Record<string, string> => {
      const token = opts.getToken();
      return token ? { authorization: `Bearer ${token}` } : {};
    },
  });

  return {
    login: (email: string, password: string) =>
      request<LoginResponse>('POST', '/auth/login', {
        body: { email, password },
      }),
    me: () => request<User>('GET', '/auth/me'),
    dashboard: () => request<Dashboard>('GET', '/admin/dashboard'),

    pipeline: {
      run: (opts: { fetch?: boolean; restructure?: boolean } = {}) =>
        request<PipelineRun>('POST', '/admin/pipeline/run', { body: opts }),
      status: () =>
        request<{ running: boolean; lastRun: PipelineRun | null }>(
          'GET',
          '/admin/pipeline/status',
        ),
    },

    articles: {
      list: (q: AdminArticlesQuery = {}) =>
        request<Page<Article>>('GET', '/admin/articles', { query: { ...q } }),
      /** Per-status counts plus `all` (which excludes the trash). */
      counts: () =>
        request<Record<ArticleStatus | 'all', number>>(
          'GET',
          '/admin/articles/counts',
        ),
      get: (id: string) => request<Article>('GET', `/admin/articles/${id}`),
      update: (id: string, body: ArticleUpdate) =>
        request<Article>('PATCH', `/admin/articles/${id}`, { body }),
      bulkStatus: (ids: string[], status: ArticleStatus) =>
        request<{ updated: number }>('POST', '/admin/articles/bulk-status', {
          body: { ids, status },
        }),
      removeTranslation: (id: string, language: Language) =>
        request<Article>(
          'DELETE',
          `/admin/articles/${id}/translations/${language}`,
        ),
      /** Permanent delete; the article must be in the trash. */
      remove: (id: string) => request<void>('DELETE', `/admin/articles/${id}`),
      revisions: (id: string, language?: Language) =>
        request<ArticleRevision[]>('GET', `/admin/articles/${id}/revisions`, {
          query: { language },
        }),
      restoreRevision: (id: string, revisionId: string) =>
        request<Article>(
          'POST',
          `/admin/articles/${id}/revisions/${revisionId}/restore`,
        ),
      chat: (id: string, language: Language) =>
        request<{ available: boolean; messages: ChatMessage[] }>(
          'GET',
          `/admin/articles/${id}/chat`,
          { query: { language } },
        ),
      sendChat: (id: string, language: Language, message: string) =>
        request<ChatMessage[]>('POST', `/admin/articles/${id}/chat`, {
          body: { language, message },
        }),
      applyChat: (id: string, messageId: string) =>
        request<ChatMessage>(
          'POST',
          `/admin/articles/${id}/chat/${messageId}/apply`,
        ),
    },

    feeds: {
      list: () => request<Feed[]>('GET', '/admin/feeds'),
      create: (body: FeedInput) =>
        request<Feed>('POST', '/admin/feeds', { body }),
      update: (id: string, body: Partial<FeedInput>) =>
        request<Feed>('PATCH', `/admin/feeds/${id}`, { body }),
      remove: (id: string) => request<void>('DELETE', `/admin/feeds/${id}`),
      fetchNow: (id: string) =>
        request<PipelineRun>('POST', `/admin/feeds/${id}/fetch`),
    },

    items: {
      list: (q: ItemsQuery = {}) =>
        request<Page<FeedItem>>('GET', '/admin/items', { query: { ...q } }),
      retry: (id: string) =>
        request<FeedItem>('POST', `/admin/items/${id}/retry`),
    },

    categories: {
      list: () => request<Category[]>('GET', '/admin/categories'),
      create: (body: CategoryInput) =>
        request<Category>('POST', '/admin/categories', { body }),
      update: (id: string, body: Partial<CategoryInput>) =>
        request<Category>('PATCH', `/admin/categories/${id}`, { body }),
      remove: (id: string) =>
        request<void>('DELETE', `/admin/categories/${id}`),
    },

    sites: {
      list: () => request<Site[]>('GET', '/admin/sites'),
      create: (body: SiteInput) =>
        request<SiteWithKey>('POST', '/admin/sites', { body }),
      update: (id: string, body: Partial<SiteInput>) =>
        request<Site>('PATCH', `/admin/sites/${id}`, { body }),
      rotateKey: (id: string) =>
        request<SiteWithKey>('POST', `/admin/sites/${id}/rotate-key`),
      remove: (id: string) => request<void>('DELETE', `/admin/sites/${id}`),
    },

    users: {
      list: () => request<User[]>('GET', '/admin/users'),
      create: (body: UserInput) =>
        request<User>('POST', '/admin/users', { body }),
      update: (id: string, body: Partial<UserInput> & { active?: boolean }) =>
        request<User>('PATCH', `/admin/users/${id}`, { body }),
      remove: (id: string) => request<void>('DELETE', `/admin/users/${id}`),
    },

    settings: {
      get: () => request<Settings>('GET', '/admin/settings'),
      update: (
        body: Partial<
          Pick<
            Settings,
            'autoPublish' | 'engine' | 'targetLanguages' | 'batchSize'
          >
        >,
      ) => request<Settings>('PATCH', '/admin/settings', { body }),
    },
  };
}

export type AdminClient = ReturnType<typeof createAdminClient>;
