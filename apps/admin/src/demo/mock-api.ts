// In-browser stand-in for the News Hoster API, used by the live demo build
// (VITE_DEMO=1). It implements the admin endpoints over in-memory data and
// simulates the pipeline and the Sarvam editorial assistant.
import type {
  Article,
  ArticleRevision,
  ArticleStatus,
  Category,
  ChatMessage,
  Feed,
  FeedItem,
  ItemStatus,
  Language,
  PipelineRun,
  Settings,
  Site,
  User,
  VersionContent,
} from '@news-hoster/sdk'
import { ARTICLES, CATEGORIES, coverImage, FEEDS, QUEUE, type SeedStory } from './seed'

type Json = Record<string, unknown>

interface StoredUser extends User {
  password: string
}
interface StoredFeed extends Omit<Feed, 'defaultCategory' | 'itemCounts'> {
  defaultCategoryId: string | null
  etag: string
}
interface StoredItem extends Omit<FeedItem, 'feed'> {
  feedId: string
  prepared?: { category: string; tags: string[]; versions: Partial<Record<Language, VersionContent>>; hue: number }
  hiddenUntilRun?: boolean
}
interface StoredArticle extends Omit<Article, 'category' | 'item'> {
  categoryId: string | null
  itemId: string | null
}
interface StoredRevision extends Omit<ArticleRevision, 'author'> {
  articleId: string
  authorId: string | null
}
interface StoredChat extends Omit<ChatMessage, 'author'> {
  articleId: string
  authorId: string | null
}
interface StoredSite extends Omit<Site, 'categories'> {
  categoryIds: string[]
  apiKeyHash: string
}
interface DB {
  version: number
  users: StoredUser[]
  categories: Category[]
  feeds: StoredFeed[]
  items: StoredItem[]
  articles: StoredArticle[]
  revisions: StoredRevision[]
  chats: StoredChat[]
  sites: StoredSite[]
  settings: Omit<Settings, 'effectiveEngine' | 'sarvamConfigured' | 'sarvamModel'>
  lastRun: PipelineRun | null
}

const STORAGE_KEY = 'nh_demo_db_v1'
const DB_VERSION = 1
export const DEMO_CREDENTIALS = { email: 'admin@demo.newshoster', password: 'demo1234' }

class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16))
const now = () => new Date().toISOString()
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
const slugify = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const truncate = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…`)

// ---- Seed ---------------------------------------------------------------------------

function seed(): DB {
  const admin: StoredUser = {
    id: uuid(),
    email: DEMO_CREDENTIALS.email,
    name: 'Demo Admin',
    role: 'admin',
    active: true,
    lastLoginAt: null,
    createdAt: hoursAgo(24 * 30),
    password: DEMO_CREDENTIALS.password,
  }
  const editor: StoredUser = {
    id: uuid(),
    email: 'editor@demo.newshoster',
    name: 'Demo Editor',
    role: 'editor',
    active: true,
    lastLoginAt: hoursAgo(5),
    createdAt: hoursAgo(24 * 20),
    password: 'demo1234',
  }
  const categories: Category[] = CATEGORIES.map(([slug, en, hi], i) => ({
    id: uuid(),
    slug,
    names: { en, hi },
    sortOrder: i * 10,
    createdAt: hoursAgo(24 * 30),
  }))
  const cat = (slug: string) => categories.find((c) => c.slug === slug)!
  const feeds: StoredFeed[] = FEEDS.map((f) => ({
    id: uuid(),
    name: f.name,
    url: f.url,
    language: f.language as Feed['language'],
    defaultCategoryId: cat(f.category).id,
    active: true,
    fetchIntervalMinutes: f.interval,
    lastFetchedAt: hoursAgo(0.3),
    lastError: null,
    createdAt: hoursAgo(24 * 30),
    etag: 'v1',
  }))
  const feedId = (key: string) => feeds[FEEDS.findIndex((f) => f.key === key)].id

  const db: DB = {
    version: DB_VERSION,
    users: [admin, editor],
    categories,
    feeds,
    items: [],
    articles: [],
    revisions: [],
    chats: [],
    sites: [],
    settings: { autoPublish: false, engine: 'auto', targetLanguages: ['en', 'hi'], batchSize: 25, updatedAt: now() },
    lastRun: null,
  }

  const makeItem = (s: SeedStory, status: ItemStatus): StoredItem => ({
    id: uuid(),
    feedId: feedId(s.feed),
    url: `${FEEDS.find((f) => f.key === s.feed)!.url.replace(/\/[^/]*$/, '')}/story/${s.key}`,
    title: s.title,
    content: s.content,
    author: null,
    imageUrl: coverImage(s.hue, cat(s.category).names.en),
    tags: s.tags,
    language: s.sourceLanguage,
    publishedAt: hoursAgo(s.hoursAgo),
    status,
    attempts: 0,
    error: null,
    createdAt: hoursAgo(s.hoursAgo),
  })

  for (const s of ARTICLES) {
    const item = makeItem(s, 'done')
    db.items.push(item)
    const article = createArticle(
      db,
      item,
      { category: s.category, tags: s.tags, versions: s.versions, hue: s.hue },
      s.status ?? 'draft',
      hoursAgo(s.hoursAgo - 0.1),
    )
    if (s.key === 'rain') {
      // A short editorial history to show revisions and the chat.
      const t = article.translations.find((x) => x.language === 'hi')!
      const at = hoursAgo(s.hoursAgo - 0.5)
      db.chats.push(
        {
          id: uuid(),
          articleId: article.id,
          language: 'hi',
          role: 'user',
          content: 'शीर्षक में “दो दिन और बारिश के आसार” जोड़ें',
          proposal: null,
          appliedRevisionId: null,
          authorId: admin.id,
          createdAt: at,
        },
        {
          id: uuid(),
          articleId: article.id,
          language: 'hi',
          role: 'assistant',
          content: 'शीर्षक में आगे के पूर्वानुमान की जानकारी जोड़ दी है; बाकी संस्करण वही है।',
          proposal: versionOf(t),
          appliedRevisionId: null,
          authorId: null,
          createdAt: at,
        },
      )
      const rev = addRevision(db, article.id, t, 'Applied assistant suggestion', admin.id, at)
      db.chats[db.chats.length - 1].appliedRevisionId = rev.id
    }
  }
  // Pending queue, a failed story and a cross-source duplicate.
  for (const s of QUEUE) {
    const item = makeItem(s, 'pending')
    item.prepared = { category: s.category, tags: s.tags, versions: s.versions, hue: s.hue }
    if (s.arrives === 'first-run') item.hiddenUntilRun = true
    db.items.push(item)
  }
  db.items.push({
    ...makeItem({ ...QUEUE[0], key: 'live', title: 'LIVE: Assembly session updates', content: 'Live blog. Updates every few minutes.', hoursAgo: 4 }, 'failed'),
    attempts: 3,
    error: 'Sarvam output is missing the "hi" version',
  })
  db.items.push({
    ...makeItem(
      {
        ...ARTICLES[0],
        key: 'rain-mirror',
        feed: 'wire',
        sourceLanguage: 'en',
        title: 'Heavy rain slows Delhi traffic',
        content: 'Same story from another outlet.',
        hoursAgo: 3,
      },
      'duplicate',
    ),
  })
  db.sites.push({
    id: uuid(),
    name: 'Khel Samachar',
    slug: 'khel-samachar',
    domain: 'khel.example.com',
    description: 'Hindi sports news',
    defaultLanguage: 'hi',
    languages: ['hi', 'en'],
    categoryIds: [cat('sports').id],
    apiKeyPrefix: 'nh_live_Xq3v',
    apiKeyHash: 'demo',
    active: true,
    createdAt: hoursAgo(24 * 10),
  })
  return db
}

function versionOf(t: VersionContent): VersionContent {
  return {
    headline: t.headline,
    summary: t.summary,
    keyPoints: [...t.keyPoints],
    body: t.body,
    seoTitle: t.seoTitle,
    metaDescription: t.metaDescription,
    focusKeyword: t.focusKeyword,
  }
}

function addRevision(db: DB, articleId: string, t: VersionContent & { language: Language }, note: string, authorId: string | null, at = now()): StoredRevision {
  const rev: StoredRevision = { id: uuid(), articleId, language: t.language, content: versionOf(t), note, authorId, createdAt: at }
  db.revisions.push(rev)
  return rev
}

function uniqueSlug(db: DB, candidates: string[], exceptId?: string): string {
  const base = candidates.map(slugify).find(Boolean) || `story-${Date.now().toString(36)}`
  let slug = base
  for (let n = 2; db.articles.some((a) => a.slug === slug && a.id !== exceptId); n++) slug = `${base}-${n}`
  return slug
}

function createArticle(db: DB, item: StoredItem, p: NonNullable<StoredItem['prepared']>, status: ArticleStatus, at = now()): StoredArticle {
  const feed = db.feeds.find((f) => f.id === item.feedId)!
  const langs = db.settings.targetLanguages
  const article: StoredArticle = {
    id: uuid(),
    slug: uniqueSlug(db, [p.versions.en?.headline ?? '', item.title]),
    sourceLanguage: item.language,
    categoryId: db.categories.find((c) => c.slug === p.category)?.id ?? feed.defaultCategoryId,
    tags: p.tags,
    imageUrl: item.imageUrl,
    sourceName: feed.name,
    sourceUrl: item.url,
    canonicalUrl: null,
    noindex: false,
    status,
    engine: 'sarvam:sarvam-105b',
    publishedAt: item.publishedAt,
    translations: langs.flatMap((l) => {
      const version = p.versions[l]
      return version ? [{ id: uuid(), language: l, ...versionOf(version) }] : []
    }),
    itemId: item.id,
    createdAt: at,
    updatedAt: at,
  }
  db.articles.push(article)
  for (const t of article.translations) addRevision(db, article.id, t, 'Created by sarvam:sarvam-105b', null, at)
  return article
}

// ---- Persistence (per viewer, best effort) ------------------------------------------------

function load(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DB
      if (parsed.version === DB_VERSION) return parsed
    }
  } catch {
    /* storage unavailable: start fresh */
  }
  return seed()
}

let db = load()

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    /* in-memory only */
  }
}

export function resetDemo() {
  db = seed()
  save()
}

// ---- Views (hydrate relations like the real API) --------------------------------------------

const categoryById = (id: string | null) => (id ? (db.categories.find((c) => c.id === id) ?? null) : null)
const userView = (u: StoredUser): User => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  active: u.active,
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
})
const authorView = (id: string | null) => {
  const u = id ? db.users.find((x) => x.id === id) : null
  return u ? userView(u) : null
}
const feedView = (f: StoredFeed, withCounts = false): Feed => {
  const { defaultCategoryId, etag: _etag, ...rest } = f
  const view: Feed = { ...rest, defaultCategory: categoryById(defaultCategoryId) }
  if (withCounts) {
    view.itemCounts = {}
    for (const i of db.items.filter((x) => x.feedId === f.id && !x.hiddenUntilRun)) view.itemCounts[i.status] = (view.itemCounts[i.status] ?? 0) + 1
  }
  return view
}
const itemView = (i: StoredItem): FeedItem => {
  const { feedId, prepared: _p, hiddenUntilRun: _h, ...rest } = i
  return { ...rest, feed: feedView(db.feeds.find((f) => f.id === feedId)!) }
}
const articleView = (a: StoredArticle, withItem = false): Article => {
  const { categoryId, itemId, ...rest } = a
  const item = itemId ? db.items.find((i) => i.id === itemId) : undefined
  return { ...copy(rest), category: categoryById(categoryId), ...(withItem ? { item: item ? itemView(item) : null } : {}) }
}
const siteView = (s: StoredSite): Site => {
  const { categoryIds, apiKeyHash: _k, ...rest } = s
  return { ...rest, categories: categoryIds.map((id) => categoryById(id)).filter((c): c is Category => Boolean(c)) }
}
const settingsView = (): Settings => ({
  ...db.settings,
  effectiveEngine: db.settings.engine === 'extractive' ? 'extractive' : 'sarvam',
  sarvamConfigured: true,
  sarvamModel: 'sarvam-105b',
})
const page = <T>(all: T[], q: URLSearchParams) => {
  const p = Math.max(1, Number(q.get('page') ?? 1))
  const limit = Math.min(100, Math.max(1, Number(q.get('limit') ?? 20)))
  return { items: all.slice((p - 1) * limit, p * limit), total: all.length, page: p, limit }
}
const byDateDesc = <T extends { publishedAt: string }>(a: T, b: T) => b.publishedAt.localeCompare(a.publishedAt)

// ---- Simulated Sarvam editorial assistant ------------------------------------------------------

function simulateAssistant(
  current: VersionContent,
  instruction: string,
  lang: Language,
  source: StoredItem | undefined,
): { reply: string; proposal: VersionContent | null } {
  const text = instruction.toLowerCase()
  const hi = lang === 'hi'
  const proposal = versionOf(current)
  const changes: string[] = []

  if (/short|छोटा|concise|संक्षिप्त/.test(text)) {
    const words = current.headline.split(/\s+/)
    proposal.headline =
      words.length > 7
        ? words
            .slice(0, 7)
            .join(' ')
            .replace(/[,:;–-]$/, '')
        : current.headline
    changes.push(hi ? 'शीर्षक छोटा किया' : 'shortened the headline')
  }
  if (/seo|meta|search|सर्च/.test(text)) {
    const kw = current.focusKeyword || current.headline.split(/\s+/).slice(0, 2).join(' ')
    proposal.focusKeyword = kw
    proposal.seoTitle = truncate(current.headline.includes(kw) ? current.headline : `${kw}: ${current.headline}`, 60)
    proposal.metaDescription = truncate(current.summary.includes(kw) ? current.summary : `${kw} — ${current.summary}`, 155)
    changes.push(hi ? 'SEO शीर्षक, मेटा विवरण और फोकस कीवर्ड सुधारे' : 'rewrote the SEO title, meta description and focus keyphrase')
  }
  if (/body|paragraph|पैराग्राफ|विवरण लिख|expand|detail/.test(text)) {
    const facts = source?.content ?? current.summary
    proposal.body = [
      current.summary,
      current.keyPoints.join(hi ? '। ' : '. ') + (hi ? '।' : '.'),
      hi ? `स्रोत के अनुसार: ${facts}` : `According to the source: ${facts}`,
    ]
      .filter((p) => p.trim().length > 2)
      .join('\n\n')
    changes.push(hi ? 'स्रोत के तथ्यों से तीन पैराग्राफ का विवरण लिखा' : 'drafted a three-paragraph body from the source facts')
  }
  if (/formal|औपचारिक|tone|भाषा/.test(text)) {
    proposal.summary = current.summary
      .replace(/\bcan't\b/g, 'cannot')
      .replace(/\bwon't\b/g, 'will not')
      .replace(/\bit's\b/gi, 'it is')
    if (!/[.।]$/.test(proposal.headline)) proposal.headline = proposal.headline.replace(/!+$/, '')
    changes.push(hi ? 'भाषा को औपचारिक रखा' : 'kept the wording formal')
  }

  const demoNote = hi
    ? '\n\n(डेमो: यह जवाब सिम्युलेटेड है। असली सिस्टम में Sarvam पूरा संस्करण फिर से लिखता है।)'
    : '\n\n(Demo: this reply is simulated. In the live system Sarvam rewrites the whole version.)'
  if (!changes.length) {
    return {
      reply:
        (hi
          ? 'डेमो में मैं शीर्षक छोटा कर सकता हूं, SEO फ़ील्ड सुधार सकता हूं, औपचारिक भाषा रख सकता हूं या स्रोत से विवरण लिख सकता हूं।'
          : 'In the demo I can shorten the headline, improve the SEO fields, keep the tone formal, or draft a body from the source.') + demoNote,
      proposal: null,
    }
  }
  return { reply: (hi ? `मैंने ${changes.join(', ')}।` : `I ${changes.join(', ')}.`) + demoNote, proposal }
}

// ---- Pipeline simulation --------------------------------------------------------------------------

function runPipeline(opts: { fetch?: boolean; restructure?: boolean; feedIds?: string[] }): PipelineRun {
  const startedAt = now()
  const fetch: PipelineRun['fetch'] = []
  if (opts.fetch !== false) {
    const feeds = db.feeds.filter((f) => (opts.feedIds ? opts.feedIds.includes(f.id) : f.active))
    for (const f of feeds) {
      const arriving = db.items.filter((i) => i.feedId === f.id && i.hiddenUntilRun)
      arriving.forEach((i) => {
        i.hiddenUntilRun = false
        i.createdAt = now()
      })
      f.lastFetchedAt = now()
      fetch.push({ feedId: f.id, feedName: f.name, status: arriving.length ? 'ok' : 'not-modified', new: arriving.length, duplicate: 0, seen: 0 })
    }
  }
  let restructure: PipelineRun['restructure'] = null
  if (opts.restructure !== false) {
    const engine = db.settings.engine === 'extractive' ? 'extractive' : 'sarvam'
    restructure = { engine, done: 0, failed: 0 }
    const pending = db.items.filter((i) => i.status === 'pending' && !i.hiddenUntilRun).slice(0, db.settings.batchSize)
    for (const item of pending) {
      if (!item.prepared) continue
      const prepared =
        engine === 'extractive'
          ? {
              ...item.prepared,
              versions: {
                [item.language]: {
                  headline: item.title,
                  summary: truncate(item.content, 300),
                  keyPoints: [],
                  body: '',
                  seoTitle: truncate(item.title, 60),
                  metaDescription: truncate(item.content, 155),
                  focusKeyword: '',
                },
              } as Partial<Record<Language, VersionContent>>,
            }
          : item.prepared
      const a = createArticle(db, item, prepared, db.settings.autoPublish ? 'published' : 'draft')
      if (engine === 'extractive') a.engine = 'extractive'
      item.status = 'done'
      restructure.done++
    }
  }
  db.lastRun = { startedAt, finishedAt: now(), fetch, restructure }
  return db.lastRun
}

// ---- Router -----------------------------------------------------------------------------------------

type Handler = (ctx: { params: string[]; q: URLSearchParams; body: Json; user: StoredUser | null }) => unknown

const routes: [string, RegExp, Handler][] = []
const on = (method: string, pattern: string, h: Handler) => routes.push([method, new RegExp(`^${pattern.replace(/:\w+/g, '([^/]+)')}$`), h])

function need(user: StoredUser | null, role?: 'admin'): StoredUser {
  if (!user) throw new HttpError(401, 'Unauthorized')
  if (role && user.role !== role) throw new HttpError(403, 'Forbidden resource')
  return user
}
const find = <T extends { id: string }>(list: T[], id: string, what: string): T => {
  const x = list.find((i) => i.id === id)
  if (!x) throw new HttpError(404, `${what} not found`)
  return x
}

on('POST', '/api/auth/login', ({ body }) => {
  const u = db.users.find((x) => x.email.toLowerCase() === String(body.email).toLowerCase() && x.password === body.password && x.active)
  if (!u) throw new HttpError(401, 'Invalid email or password')
  u.lastLoginAt = now()
  return { accessToken: `demo:${u.id}`, user: userView(u) }
})
on('GET', '/api/auth/me', ({ user }) => userView(need(user)))

on('GET', '/api/admin/dashboard', ({ user }) => {
  need(user)
  const count = <T extends { status: string }>(list: T[]) => list.reduce<Record<string, number>>((m, x) => ((m[x.status] = (m[x.status] ?? 0) + 1), m), {})
  return {
    articles: count(db.articles),
    items: count(db.items.filter((i) => !i.hiddenUntilRun)),
    feeds: { total: db.feeds.length, active: db.feeds.filter((f) => f.active).length, failing: [] },
    sites: db.sites.length,
    settings: settingsView(),
    pipeline: { running: false, lastRun: db.lastRun },
  }
})
on('POST', '/api/admin/pipeline/run', ({ user, body }) => (need(user), runPipeline(body)))
on('GET', '/api/admin/pipeline/status', ({ user }) => (need(user), { running: false, lastRun: db.lastRun }))

// Articles
on('GET', '/api/admin/articles/counts', ({ user }) => {
  need(user)
  const counts: Record<string, number> = { draft: 0, published: 0, rejected: 0, trash: 0 }
  for (const a of db.articles) counts[a.status]++
  counts.all = counts.draft + counts.published + counts.rejected
  return counts
})
on('GET', '/api/admin/articles', ({ user, q }) => {
  need(user)
  const status = q.get('status')
  const search = q.get('q')?.toLowerCase()
  const list = db.articles
    .filter((a) => (status ? a.status === status : a.status !== 'trash'))
    .filter((a) => !q.get('categoryId') || a.categoryId === q.get('categoryId'))
    .filter((a) => !q.get('sourceLanguage') || a.sourceLanguage === q.get('sourceLanguage'))
    .filter((a) => !search || a.translations.some((t) => t.headline.toLowerCase().includes(search)))
    .sort(byDateDesc)
  const p = page(list, q)
  return { ...p, items: p.items.map((a) => articleView(a)) }
})
on('POST', '/api/admin/articles/bulk-status', ({ user, body }) => {
  need(user)
  const ids = body.ids as string[]
  let updated = 0
  for (const a of db.articles.filter((x) => ids.includes(x.id))) {
    a.status = body.status as ArticleStatus
    a.updatedAt = now()
    updated++
  }
  return { updated }
})
on('GET', '/api/admin/articles/:id', ({ user, params }) => (need(user), articleView(find(db.articles, params[0], 'Article'), true)))
on('PATCH', '/api/admin/articles/:id', ({ user, params, body }) => {
  const me = need(user)
  const a = find(db.articles, params[0], 'Article')
  if (body.slug !== undefined && body.slug !== a.slug) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(body.slug))) throw new HttpError(400, 'slug must be lowercase letters, digits and dashes')
    if (db.articles.some((x) => x.slug === body.slug)) throw new HttpError(409, 'Slug already in use')
    a.slug = String(body.slug)
  }
  if (body.status !== undefined) a.status = body.status as ArticleStatus
  if (body.tags !== undefined) a.tags = [...new Set((body.tags as string[]).map((t) => t.trim().toLowerCase()).filter(Boolean))]
  if (body.imageUrl !== undefined) a.imageUrl = (body.imageUrl as string) || null
  if (body.canonicalUrl !== undefined) a.canonicalUrl = (body.canonicalUrl as string) || null
  if (body.noindex !== undefined) a.noindex = Boolean(body.noindex)
  if (body.categoryId !== undefined) a.categoryId = (body.categoryId as string) || null
  for (const t of (body.translations as (VersionContent & { language: Language })[] | undefined) ?? []) {
    const incoming = { ...t, keyPoints: t.keyPoints.map((p) => p.trim()).filter(Boolean) }
    let existing = a.translations.find((x) => x.language === t.language)
    const before = existing ? JSON.stringify(versionOf(existing)) : ''
    if (!existing) {
      existing = { id: uuid(), language: t.language, headline: '', summary: '', keyPoints: [], body: '', seoTitle: '', metaDescription: '', focusKeyword: '' }
      a.translations.push(existing)
    }
    Object.assign(existing, versionOf({ ...existing, ...incoming }))
    if (JSON.stringify(versionOf(existing)) !== before) addRevision(db, a.id, existing, 'Edited', me.id)
  }
  a.updatedAt = now()
  return articleView(a, true)
})
on('DELETE', '/api/admin/articles/:id', ({ user, params }) => {
  need(user)
  const a = find(db.articles, params[0], 'Article')
  if (a.status !== 'trash') throw new HttpError(409, 'Move the article to the trash before deleting it permanently')
  db.articles = db.articles.filter((x) => x.id !== a.id)
  return undefined
})
on('GET', '/api/admin/articles/:id/revisions', ({ user, params, q }) => {
  need(user)
  return db.revisions
    .filter((r) => r.articleId === params[0] && (!q.get('language') || r.language === q.get('language')))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ articleId: _a, authorId, ...r }) => ({ ...copy(r), author: authorView(authorId) }))
})
on('POST', '/api/admin/articles/:id/revisions/:rev/restore', ({ user, params }) => {
  const me = need(user)
  const a = find(db.articles, params[0], 'Article')
  const rev = find(db.revisions, params[1], 'Revision')
  let t = a.translations.find((x) => x.language === rev.language)
  if (!t) {
    t = { id: uuid(), language: rev.language, ...versionOf(rev.content) }
    a.translations.push(t)
  } else Object.assign(t, versionOf(rev.content))
  addRevision(db, a.id, t, `Restored revision from ${rev.createdAt}`, me.id)
  a.updatedAt = now()
  return articleView(a, true)
})
const chatView = ({ articleId: _a, authorId, ...m }: StoredChat): ChatMessage => ({ ...copy(m), author: authorView(authorId) })
on('GET', '/api/admin/articles/:id/chat', ({ user, params, q }) => {
  need(user)
  return { available: true, messages: db.chats.filter((m) => m.articleId === params[0] && m.language === q.get('language')).map(chatView) }
})
on('POST', '/api/admin/articles/:id/chat', ({ user, params, body }) => {
  const me = need(user)
  const a = find(db.articles, params[0], 'Article')
  const lang = body.language as Language
  const t = a.translations.find((x) => x.language === lang)
  if (!t) throw new HttpError(404, `This article has no "${lang}" version`)
  const mine: StoredChat = {
    id: uuid(),
    articleId: a.id,
    language: lang,
    role: 'user',
    content: String(body.message),
    proposal: null,
    appliedRevisionId: null,
    authorId: me.id,
    createdAt: now(),
  }
  const s = simulateAssistant(
    versionOf(t),
    String(body.message),
    lang,
    db.items.find((i) => i.id === a.itemId),
  )
  const reply: StoredChat = {
    id: uuid(),
    articleId: a.id,
    language: lang,
    role: 'assistant',
    content: s.reply,
    proposal: s.proposal,
    appliedRevisionId: null,
    authorId: null,
    createdAt: now(),
  }
  db.chats.push(mine, reply)
  return [chatView(mine), chatView(reply)]
})
on('POST', '/api/admin/articles/:id/chat/:msg/apply', ({ user, params }) => {
  const me = need(user)
  const a = find(db.articles, params[0], 'Article')
  const m = find(db.chats, params[1], 'Message')
  if (!m.proposal) throw new HttpError(409, 'This message has no proposal to apply')
  if (m.appliedRevisionId) throw new HttpError(409, 'This proposal was already applied')
  const t = a.translations.find((x) => x.language === m.language)!
  Object.assign(t, versionOf(m.proposal))
  m.appliedRevisionId = addRevision(db, a.id, t, 'Applied assistant suggestion', me.id).id
  a.updatedAt = now()
  return chatView(m)
})

// Feeds & queue
on('GET', '/api/admin/feeds', ({ user }) => (need(user), db.feeds.map((f) => feedView(f, true))))
const feedFrom = (body: Json, f?: StoredFeed): StoredFeed => {
  if (!body.name && !f) throw new HttpError(400, 'name should not be empty')
  if (body.url !== undefined && !/^https?:\/\/\S+$/.test(String(body.url))) throw new HttpError(400, 'url must be a URL address')
  if (body.url && db.feeds.some((x) => x.url === body.url && x.id !== f?.id)) throw new HttpError(409, 'This feed URL is already registered')
  return {
    id: f?.id ?? uuid(),
    name: String(body.name ?? f?.name),
    url: String(body.url ?? f?.url),
    language: (body.language as Feed['language']) ?? f?.language ?? 'auto',
    defaultCategoryId: body.defaultCategoryId !== undefined ? (body.defaultCategoryId as string) || null : (f?.defaultCategoryId ?? null),
    active: body.active !== undefined ? Boolean(body.active) : (f?.active ?? true),
    fetchIntervalMinutes: Number(body.fetchIntervalMinutes ?? f?.fetchIntervalMinutes ?? 30),
    lastFetchedAt: f?.lastFetchedAt ?? null,
    lastError: f?.lastError ?? null,
    createdAt: f?.createdAt ?? now(),
    etag: f?.etag ?? '',
  }
}
on('POST', '/api/admin/feeds', ({ user, body }) => {
  need(user)
  const f = feedFrom(body)
  db.feeds.push(f)
  return feedView(f)
})
on('PATCH', '/api/admin/feeds/:id', ({ user, params, body }) => {
  need(user)
  const i = db.feeds.findIndex((f) => f.id === params[0])
  if (i < 0) throw new HttpError(404, 'Feed not found')
  db.feeds[i] = feedFrom(body, db.feeds[i])
  return feedView(db.feeds[i])
})
on('DELETE', '/api/admin/feeds/:id', ({ user, params }) => {
  need(user)
  find(db.feeds, params[0], 'Feed')
  db.feeds = db.feeds.filter((f) => f.id !== params[0])
  db.items = db.items.filter((i) => i.feedId !== params[0])
  return undefined
})
on('POST', '/api/admin/feeds/:id/fetch', ({ user, params }) => {
  need(user)
  const f = find(db.feeds, params[0], 'Feed')
  if (!f.url.includes('example.')) {
    // Real feeds can't be fetched from inside the demo page.
    f.lastError = 'Demo mode: feeds outside the example data are not fetched in the browser'
    f.lastFetchedAt = now()
    return (db.lastRun = {
      startedAt: now(),
      finishedAt: now(),
      fetch: [{ feedId: f.id, feedName: f.name, status: 'error', new: 0, duplicate: 0, seen: 0, error: f.lastError }],
      restructure: null,
    })
  }
  return runPipeline({ feedIds: [f.id], restructure: false })
})
on('GET', '/api/admin/items', ({ user, q }) => {
  need(user)
  const list = db.items
    .filter((i) => !i.hiddenUntilRun)
    .filter((i) => !q.get('status') || i.status === q.get('status'))
    .filter((i) => !q.get('feedId') || i.feedId === q.get('feedId'))
    .sort(byDateDesc)
  const p = page(list, q)
  return { ...p, items: p.items.map(itemView) }
})
on('POST', '/api/admin/items/:id/retry', ({ user, params }) => {
  need(user)
  const i = find(db.items, params[0], 'Item')
  if (i.status === 'done') throw new HttpError(409, 'Item was already restructured')
  Object.assign(i, { status: 'pending', attempts: 0, error: null })
  return itemView(i)
})

// Categories
const categoryFrom = (body: Json, c?: Category): Category => {
  const names = (body.names as Category['names']) ?? c?.names
  if (!names?.en?.trim()) throw new HttpError(400, 'names.en is required')
  const slug = String(body.slug ?? c?.slug ?? '')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError(400, 'slug must be lowercase letters, digits and dashes')
  if (db.categories.some((x) => x.slug === slug && x.id !== c?.id)) throw new HttpError(409, 'Slug already in use')
  return { id: c?.id ?? uuid(), slug, names, sortOrder: Number(body.sortOrder ?? c?.sortOrder ?? 0), createdAt: c?.createdAt ?? now() }
}
on('GET', '/api/admin/categories', ({ user }) => (need(user), [...db.categories].sort((a, b) => a.sortOrder - b.sortOrder)))
on('POST', '/api/admin/categories', ({ user, body }) => {
  need(user)
  const c = categoryFrom(body)
  db.categories.push(c)
  return c
})
on('PATCH', '/api/admin/categories/:id', ({ user, params, body }) => {
  need(user)
  const i = db.categories.findIndex((c) => c.id === params[0])
  if (i < 0) throw new HttpError(404, 'Category not found')
  return (db.categories[i] = categoryFrom(body, db.categories[i]))
})
on('DELETE', '/api/admin/categories/:id', ({ user, params }) => {
  need(user)
  find(db.categories, params[0], 'Category')
  db.categories = db.categories.filter((c) => c.id !== params[0])
  for (const a of db.articles) if (a.categoryId === params[0]) a.categoryId = null
  return undefined
})

// Sites
const newKey = () =>
  `nh_live_${Array.from({ length: 32 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[(Math.random() * 57) | 0]).join('')}`
const siteFrom = (body: Json, s?: StoredSite): StoredSite => {
  const languages = (body.languages as Language[]) ?? s?.languages ?? ['en']
  const defaultLanguage = (body.defaultLanguage as Language) ?? s?.defaultLanguage ?? 'en'
  if (!languages.includes(defaultLanguage)) throw new HttpError(400, 'defaultLanguage must be one of languages')
  const slug = String(body.slug ?? s?.slug ?? '')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError(400, 'slug must be lowercase letters, digits and dashes')
  if (db.sites.some((x) => x.slug === slug && x.id !== s?.id)) throw new HttpError(409, 'Slug already in use')
  if (!String(body.name ?? s?.name ?? '').trim()) throw new HttpError(400, 'name should not be empty')
  return {
    id: s?.id ?? uuid(),
    name: String(body.name ?? s?.name),
    slug,
    domain: body.domain !== undefined ? (body.domain as string) || null : (s?.domain ?? null),
    description: String(body.description ?? s?.description ?? ''),
    defaultLanguage,
    languages,
    categoryIds: (body.categoryIds as string[]) ?? s?.categoryIds ?? [],
    apiKeyPrefix: s?.apiKeyPrefix ?? '',
    apiKeyHash: s?.apiKeyHash ?? '',
    active: body.active !== undefined ? Boolean(body.active) : (s?.active ?? true),
    createdAt: s?.createdAt ?? now(),
  }
}
on('GET', '/api/admin/sites', ({ user }) => (need(user, 'admin'), db.sites.map(siteView)))
on('POST', '/api/admin/sites', ({ user, body }) => {
  need(user, 'admin')
  const s = siteFrom(body)
  const apiKey = newKey()
  Object.assign(s, { apiKeyPrefix: apiKey.slice(0, 12), apiKeyHash: 'demo' })
  db.sites.push(s)
  return { site: siteView(s), apiKey }
})
on('PATCH', '/api/admin/sites/:id', ({ user, params, body }) => {
  need(user, 'admin')
  const i = db.sites.findIndex((s) => s.id === params[0])
  if (i < 0) throw new HttpError(404, 'Site not found')
  return siteView((db.sites[i] = siteFrom(body, db.sites[i])))
})
on('POST', '/api/admin/sites/:id/rotate-key', ({ user, params }) => {
  need(user, 'admin')
  const s = find(db.sites, params[0], 'Site')
  const apiKey = newKey()
  s.apiKeyPrefix = apiKey.slice(0, 12)
  return { site: siteView(s), apiKey }
})
on('DELETE', '/api/admin/sites/:id', ({ user, params }) => {
  need(user, 'admin')
  find(db.sites, params[0], 'Site')
  db.sites = db.sites.filter((s) => s.id !== params[0])
  return undefined
})

// Users
on('GET', '/api/admin/users', ({ user }) => (need(user, 'admin'), db.users.map(userView)))
on('POST', '/api/admin/users', ({ user, body }) => {
  need(user, 'admin')
  const email = String(body.email ?? '').toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'email must be an email')
  if (String(body.password ?? '').length < 8) throw new HttpError(400, 'password must be longer than or equal to 8 characters')
  if (db.users.some((u) => u.email === email)) throw new HttpError(409, 'Email already in use')
  const u: StoredUser = {
    id: uuid(),
    email,
    name: String(body.name),
    role: body.role === 'admin' ? 'admin' : 'editor',
    active: true,
    lastLoginAt: null,
    createdAt: now(),
    password: String(body.password),
  }
  db.users.push(u)
  return userView(u)
})
on('PATCH', '/api/admin/users/:id', ({ user, params, body }) => {
  const me = need(user, 'admin')
  const u = find(db.users, params[0], 'User')
  if (u.id === me.id && (body.active === false || (body.role && body.role !== 'admin'))) throw new HttpError(400, 'You cannot deactivate or demote yourself')
  if (body.password !== undefined && String(body.password).length < 8) throw new HttpError(400, 'password must be longer than or equal to 8 characters')
  if (body.name !== undefined) u.name = String(body.name)
  if (body.email !== undefined) u.email = String(body.email).toLowerCase()
  if (body.role !== undefined) u.role = body.role === 'admin' ? 'admin' : 'editor'
  if (body.active !== undefined) u.active = Boolean(body.active)
  if (body.password) u.password = String(body.password)
  return userView(u)
})
on('DELETE', '/api/admin/users/:id', ({ user, params }) => {
  const me = need(user, 'admin')
  if (params[0] === me.id) throw new HttpError(400, 'You cannot delete yourself')
  find(db.users, params[0], 'User')
  db.users = db.users.filter((u) => u.id !== params[0])
  return undefined
})

// Settings
on('GET', '/api/admin/settings', ({ user }) => (need(user), settingsView()))
on('PATCH', '/api/admin/settings', ({ user, body }) => {
  need(user, 'admin')
  Object.assign(db.settings, body, { updatedAt: now() })
  return settingsView()
})

// ---- fetch() replacement ------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const demoFetch: typeof fetch = async (input, init) => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const url = new URL(raw, 'https://demo.local')
  const method = (init?.method ?? 'GET').toUpperCase()
  const body = typeof init?.body === 'string' && init.body ? (JSON.parse(init.body) as Json) : {}
  const headers = new Headers(init?.headers)
  const token = headers.get('authorization')?.replace(/^Bearer demo:/, '')
  const user = db.users.find((u) => u.id === token && u.active) ?? null

  // A little latency so loading states are visible; the "assistant" takes longer.
  await sleep(url.pathname.endsWith('/chat') && method === 'POST' ? 900 : url.pathname.endsWith('/pipeline/run') ? 700 : 120)

  for (const [m, re, handler] of routes) {
    const match = method === m ? re.exec(url.pathname) : null
    if (!match) continue
    try {
      const result = handler({ params: match.slice(1).map(decodeURIComponent), q: url.searchParams, body, user })
      save()
      if (result === undefined) return new Response(null, { status: 204 })
      return new Response(JSON.stringify(result), {
        status: method === 'POST' && /\/(users|feeds|categories|sites)$/.test(url.pathname) ? 201 : 200,
        headers: { 'content-type': 'application/json' },
      })
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500
      return new Response(JSON.stringify({ statusCode: status, message: err instanceof Error ? err.message : String(err) }), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    }
  }
  return new Response(JSON.stringify({ statusCode: 404, message: `Cannot ${method} ${url.pathname}` }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  })
}
