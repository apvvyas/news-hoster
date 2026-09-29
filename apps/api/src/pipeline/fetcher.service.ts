import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Parser from 'rss-parser';
import { MoreThan, Repository } from 'typeorm';
import { detectLanguage, isLanguage } from '../common/languages.js';
import { canonicalUrl, stripHtml, titleKey } from '../common/text.js';
import { FeedItem, ItemStatus } from '../feeds/feed-item.entity.js';
import { Feed } from '../feeds/feed.entity.js';

const USER_AGENT = 'news-hoster/1.0 (+https://github.com/apvvyas/news-hoster)';
const FETCH_TIMEOUT_MS = 20_000;
const DUPLICATE_WINDOW_DAYS = 3;

type RawItem = Parser.Item & {
  contentEncoded?: string;
  mediaContent?: { $?: { url?: string; medium?: string; type?: string } }[];
  mediaThumbnail?: { $?: { url?: string } };
  id?: string;
};

export interface NormalizedItem {
  url: string;
  guid: string | null;
  title: string;
  content: string;
  author: string | null;
  imageUrl: string | null;
  tags: string[];
  publishedAt: Date;
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

const parser = new Parser<Record<string, unknown>, RawItem>({
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail'],
    ],
  },
});

/** Turn parsed feed entries into clean, normalised items. */
export function normalizeItems(items: RawItem[]): NormalizedItem[] {
  const out: NormalizedItem[] = [];
  for (const it of items) {
    const title = stripHtml(it.title);
    const link = it.link?.trim();
    if (!title || !link) continue;
    let url: string;
    try {
      url = canonicalUrl(link);
    } catch {
      continue;
    }
    const bodies = [
      it.contentEncoded,
      it.content,
      it.summary,
      it.contentSnippet,
    ].filter(Boolean) as string[];
    const content = stripHtml(bodies.sort((a, b) => b.length - a.length)[0]);
    const date = new Date(it.isoDate ?? it.pubDate ?? Date.now());
    out.push({
      url,
      guid: it.guid ?? it.id ?? null,
      title,
      content,
      author:
        stripHtml(it.creator ?? (it as { author?: string }).author) || null,
      imageUrl: imageOf(it),
      tags: (it.categories ?? [])
        .map((c) =>
          typeof c === 'string' ? c : String((c as { _?: string })._ ?? ''),
        )
        .filter(Boolean),
      publishedAt: Number.isNaN(date.getTime()) ? new Date() : date,
    });
  }
  return out;
}

function imageOf(it: RawItem): string | null {
  for (const m of it.mediaContent ?? []) {
    const a = m.$ ?? {};
    if (
      a.url &&
      (a.medium === 'image' ||
        a.type?.startsWith('image/') ||
        (!a.medium && !a.type))
    )
      return a.url;
  }
  if (it.mediaThumbnail?.$?.url) return it.mediaThumbnail.$.url;
  if (it.enclosure?.url && (it.enclosure.type ?? '').startsWith('image/'))
    return it.enclosure.url;
  return null;
}

@Injectable()
export class FetcherService {
  private readonly log = new Logger(FetcherService.name);

  constructor(
    @InjectRepository(Feed) private readonly feeds: Repository<Feed>,
    @InjectRepository(FeedItem) private readonly items: Repository<FeedItem>,
  ) {}

  /** Feeds that are active and whose fetch interval has elapsed. */
  async dueFeeds(now = new Date()): Promise<Feed[]> {
    const feeds = await this.feeds.findBy({ active: true });
    return feeds.filter(
      (f) =>
        !f.lastFetchedAt ||
        now.getTime() - f.lastFetchedAt.getTime() >=
          f.fetchIntervalMinutes * 60_000,
    );
  }

  async fetchFeed(feed: Feed): Promise<FetchResult> {
    const result: FetchResult = {
      feedId: feed.id,
      feedName: feed.name,
      status: 'ok',
      new: 0,
      duplicate: 0,
      seen: 0,
    };
    try {
      const headers: Record<string, string> = {
        'user-agent': USER_AGENT,
        accept:
          'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      };
      if (feed.etag) headers['if-none-match'] = feed.etag;
      if (feed.lastModified) headers['if-modified-since'] = feed.lastModified;
      const res = await fetch(feed.url, {
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: 'follow',
      });
      if (res.status === 304) {
        result.status = 'not-modified';
        await this.feeds.update(feed.id, {
          lastFetchedAt: new Date(),
          lastError: null,
        });
        return result;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = await parser.parseString(await res.text());
      for (const item of normalizeItems(parsed.items)) {
        result[await this.store(feed, item)]++;
      }
      await this.feeds.update(feed.id, {
        etag: res.headers.get('etag'),
        lastModified: res.headers.get('last-modified'),
        lastFetchedAt: new Date(),
        lastError: null,
      });
      this.log.log(
        `${feed.name}: ${result.new} new, ${result.duplicate} duplicate, ${result.seen} seen`,
      );
    } catch (err) {
      const cause =
        err instanceof Error && err.cause instanceof Error
          ? ` (${err.cause.message})`
          : '';
      result.status = 'error';
      result.error =
        `${err instanceof Error ? err.message : String(err)}${cause}`.slice(
          0,
          500,
        );
      await this.feeds.update(feed.id, {
        lastFetchedAt: new Date(),
        lastError: result.error,
      });
      this.log.warn(`${feed.name} (${feed.url}): ${result.error}`);
    }
    return result;
  }

  /** Insert one item unless we already have it. */
  async store(
    feed: Feed,
    n: NormalizedItem,
  ): Promise<'new' | 'duplicate' | 'seen'> {
    if (await this.items.existsBy({ url: n.url })) return 'seen';
    const key = titleKey(n.title);
    const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 86_400_000);
    // Same headline recently collected from another source -> keep for the record, don't publish twice.
    const dup =
      key &&
      (await this.items.existsBy({
        titleKey: key,
        createdAt: MoreThan(since),
      }));
    const language = isLanguage(feed.language)
      ? feed.language
      : detectLanguage(`${n.title} ${n.content}`);
    const res = await this.items
      .createQueryBuilder()
      .insert()
      .values({
        ...n,
        feed: { id: feed.id },
        titleKey: key,
        language,
        status: dup ? ItemStatus.Duplicate : ItemStatus.Pending,
      })
      .orIgnore() // another run inserted the same URL concurrently
      .execute();
    if (!res.identifiers.length || !res.identifiers[0]) return 'seen';
    return dup ? 'duplicate' : 'new';
  }
}
