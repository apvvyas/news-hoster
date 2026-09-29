import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { loadConfig } from '../src/config/configuration.js';
import { ExtractiveRestructurer } from '../src/pipeline/extractive.restructurer.js';
import {
  RESTRUCTURER_FACTORY,
  type RestructurerFactory,
} from '../src/pipeline/pipeline.service.js';
import type {
  RestructureInput,
  Restructurer,
} from '../src/pipeline/restructurer.js';
import { RestructureEngine } from '../src/settings/settings.entity.js';

const TEST_DB =
  process.env.TEST_DATABASE_URL ??
  'postgres://news:news@localhost:5432/news_hoster_test';
const ADMIN = { email: 'admin@test.local', password: 'admin-password-1' };

/** Stands in for Sarvam: deterministic bilingual output, fails on demand. */
class FakeSarvam implements Restructurer {
  readonly name = 'sarvam';
  calls: RestructureInput[] = [];
  async restructure(input: RestructureInput) {
    this.calls.push(input);
    if (input.title.includes('FAIL')) throw new Error('model declined');
    return {
      categorySlug: /team|championship/i.test(input.title)
        ? 'sports'
        : input.categoryHint,
      tags: ['test'],
      engine: 'sarvam:fake',
      translations: input.targetLanguages.map((language) => ({
        language,
        headline:
          language === 'hi' ? `हिंदी: ${input.title}` : `EN: ${input.title}`,
        summary: `${language} summary`,
        keyPoints: [`${language} point`],
      })),
    };
  }
}

describe('News Hoster API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let feedServer: Server;
  let feedBase: string;
  let token: string;
  const fake = new FakeSarvam();
  const feedHits: Record<string, number> = {};

  const auth = () => ({ authorization: `Bearer ${token}` });

  beforeAll(async () => {
    // Local HTTP server that serves the fixture feeds, with ETag support.
    feedServer = createServer((req, res) => {
      const name = req.url!.slice(1);
      feedHits[name] = (feedHits[name] ?? 0) + 1;
      const etag = `"${name}-v1"`;
      if (req.headers['if-none-match'] === etag)
        return void res.writeHead(304).end();
      try {
        const body = readFileSync(
          new URL(`./fixtures/${name}`, import.meta.url),
        );
        res
          .writeHead(200, { 'content-type': 'application/rss+xml', etag })
          .end(body);
      } catch {
        res.writeHead(404).end();
      }
    });
    await new Promise<void>((r) => feedServer.listen(0, '127.0.0.1', r));
    feedBase = `http://127.0.0.1:${(feedServer.address() as AddressInfo).port}`;

    // Fresh schema every run.
    const reset = new DataSource({ type: 'postgres', url: TEST_DB });
    await reset.initialize();
    await reset.query(
      'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;',
    );
    await reset.destroy();

    Object.assign(process.env, {
      DATABASE_URL: TEST_DB,
      ADMIN_EMAIL: ADMIN.email,
      ADMIN_PASSWORD: ADMIN.password,
      PIPELINE_INTERVAL_MINUTES: '0',
      RATE_LIMIT_PER_MINUTE: '10000',
    });
    const { AppModule } = await import('../src/app.module.js');
    const { setupApp } = await import('../src/setup-app.js');
    const factory: RestructurerFactory = (engine) =>
      engine === RestructureEngine.Sarvam ? fake : new ExtractiveRestructurer();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RESTRUCTURER_FACTORY)
      .useValue(factory)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app, loadConfig());
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
    feedServer?.close();
  });

  describe('auth', () => {
    it('rejects bad credentials and accepts the seeded admin', async () => {
      await http
        .post('/api/auth/login')
        .send({ email: ADMIN.email, password: 'wrong' })
        .expect(401);
      const res = await http.post('/api/auth/login').send(ADMIN).expect(200);
      token = res.body.accessToken;
      expect(res.body.user).toMatchObject({
        email: ADMIN.email,
        role: 'admin',
      });
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('protects admin routes', async () => {
      await http.get('/api/admin/feeds').expect(401);
      await http
        .get('/api/admin/feeds')
        .set({ authorization: 'Bearer nope' })
        .expect(401);
      await http.get('/api/auth/me').set(auth()).expect(200);
    });

    it('enforces roles', async () => {
      await http
        .post('/api/admin/users')
        .set(auth())
        .send({
          email: 'ed@test.local',
          name: 'Ed',
          password: 'editor-pass-1',
          role: 'editor',
        })
        .expect(201);
      const ed = await http
        .post('/api/auth/login')
        .send({ email: 'ed@test.local', password: 'editor-pass-1' })
        .expect(200);
      const edAuth = { authorization: `Bearer ${ed.body.accessToken}` };
      await http.get('/api/admin/feeds').set(edAuth).expect(200);
      await http.get('/api/admin/users').set(edAuth).expect(403);
      await http.post('/api/admin/sites').set(edAuth).send({}).expect(403);
    });

    it('validates input', async () => {
      const res = await http
        .post('/api/admin/users')
        .set(auth())
        .send({
          email: 'not-an-email',
          name: 'x',
          password: 'short',
          role: 'boss',
        })
        .expect(400);
      expect(res.body.message.join(' ')).toMatch(/email/);
    });
  });

  describe('ingestion pipeline', () => {
    let categories: { id: string; slug: string }[];

    it('has seeded bilingual categories', async () => {
      categories = (
        await http.get('/api/admin/categories').set(auth()).expect(200)
      ).body;
      const sports = categories.find((c) => c.slug === 'sports') as any;
      expect(sports.names).toEqual({ en: 'Sports', hi: 'खेल' });
    });

    it('fetches, dedupes and restructures with the extractive engine', async () => {
      const other = categories.find((c) => c.slug === 'other')!;
      for (const [name, file, language] of [
        ['Wire', 'en.xml', 'auto'],
        ['Mirror', 'en-mirror.xml', 'en'],
        ['Hindi', 'hi.xml', 'auto'],
      ]) {
        await http
          .post('/api/admin/feeds')
          .set(auth())
          .send({
            name,
            url: `${feedBase}/${file}`,
            language,
            defaultCategoryId: other.id,
          })
          .expect(201);
      }
      await http
        .post('/api/admin/feeds')
        .set(auth())
        .send({ name: 'Dup', url: `${feedBase}/en.xml` })
        .expect(409);

      await http
        .patch('/api/admin/settings')
        .set(auth())
        .send({ engine: 'extractive', batchSize: 1 })
        .expect(200);
      const run = (
        await http
          .post('/api/admin/pipeline/run')
          .set(auth())
          .send({})
          .expect(200)
      ).body;
      expect(
        run.fetch.map((f: any) => [f.feedName, f.status, f.new, f.duplicate]),
      ).toEqual(
        expect.arrayContaining([
          ['Wire', 'ok', 3, 0],
          ['Mirror', 'ok', 0, 1], // same headline as the Wire story
          ['Hindi', 'ok', 1, 0],
        ]),
      );
      expect(run.restructure).toMatchObject({
        engine: 'extractive',
        done: 1,
        failed: 0,
      });

      const items = (
        await http
          .get('/api/admin/items')
          .set(auth())
          .query({ limit: 50 })
          .expect(200)
      ).body;
      expect(items.total).toBe(5);
      const hindi = items.items.find(
        (i: any) => i.url === 'https://hindi.example/delhi-rain',
      );
      expect(hindi.language).toBe('hi');
      const bikes = items.items.find(
        (i: any) => i.title === 'City council approves new bike lanes',
      );
      expect(bikes.url).toBe('https://wire.example/news/bike-lanes?id=7');
      expect(bikes.content).not.toContain('alert');
      expect(bikes.imageUrl).toBe('https://wire.example/img/bikes.jpg');
    });

    it('uses conditional GET on the next fetch', async () => {
      const feeds = (await http.get('/api/admin/feeds').set(auth()).expect(200))
        .body;
      const wire = feeds.find((f: any) => f.name === 'Wire');
      const run = (
        await http
          .post(`/api/admin/feeds/${wire.id}/fetch`)
          .set(auth())
          .expect(200)
      ).body;
      expect(run.fetch[0].status).toBe('not-modified');
    });

    it('restructures the rest with Sarvam into English and Hindi', async () => {
      await http
        .patch('/api/admin/settings')
        .set(auth())
        .send({ engine: 'sarvam', batchSize: 25 })
        .expect(200);
      const run = (
        await http
          .post('/api/admin/pipeline/run')
          .set(auth())
          .send({ fetch: false })
          .expect(200)
      ).body;
      expect(run.restructure).toMatchObject({
        engine: 'sarvam',
        done: 2,
        failed: 1,
      });
      expect(
        fake.calls.every((c) => c.targetLanguages.join() === 'en,hi'),
      ).toBe(true);

      const list = (
        await http.get('/api/admin/articles').set(auth()).expect(200)
      ).body;
      expect(list.total).toBe(3);
      const otters = list.items.find(
        (a: any) => a.engine === 'sarvam:fake' && a.category?.slug === 'sports',
      );
      expect(otters.status).toBe('draft');
      expect(otters.slug).toBe('en-local-team-wins-championship');
      expect(otters.translations.map((t: any) => t.language).sort()).toEqual([
        'en',
        'hi',
      ]);
    });

    it('gives up on a story after 3 failed attempts', async () => {
      for (let i = 0; i < 2; i++)
        await http
          .post('/api/admin/pipeline/run')
          .set(auth())
          .send({ fetch: false })
          .expect(200);
      const failed = (
        await http
          .get('/api/admin/items')
          .set(auth())
          .query({ status: 'failed' })
          .expect(200)
      ).body;
      expect(failed.items).toHaveLength(1);
      expect(failed.items[0]).toMatchObject({
        title: 'FAIL THIS STORY',
        attempts: 3,
        error: 'model declined',
      });
      const retried = (
        await http
          .post(`/api/admin/items/${failed.items[0].id}/retry`)
          .set(auth())
          .expect(201)
      ).body;
      expect(retried).toMatchObject({ status: 'pending', attempts: 0 });
    });

    it('reports on the dashboard', async () => {
      const d = (await http.get('/api/admin/dashboard').set(auth()).expect(200))
        .body;
      expect(d.articles).toEqual({ draft: 3 });
      expect(d.items).toMatchObject({ done: 3, duplicate: 1, pending: 1 });
      expect(d.feeds).toMatchObject({ total: 3, active: 3, failing: [] });
    });
  });

  describe('public API for websites', () => {
    let hindiKey: string;
    let englishKey: string;

    it('lets admins edit and publish articles', async () => {
      const list = (
        await http.get('/api/admin/articles').set(auth()).expect(200)
      ).body;
      const ids = list.items.map((a: any) => a.id);
      await http
        .post('/api/admin/articles/bulk-status')
        .set(auth())
        .send({ ids, status: 'published' })
        .expect(200);

      // The first (extractive, batch of 1) run took the newest story: the Hindi one.
      const rain = list.items.find((a: any) => a.engine === 'extractive');
      expect(rain.sourceLanguage).toBe('hi');
      expect(rain.translations.map((t: any) => t.language)).toEqual(['hi']); // extractive can't translate
      expect(rain.slug).toMatch(/^story-/); // no Latin text to build a slug from
      const edited = (
        await http
          .patch(`/api/admin/articles/${rain.id}`)
          .set(auth())
          .send({
            translations: [
              {
                language: 'en',
                headline: 'Heavy rain disrupts Delhi traffic',
                summary: 'Delhi saw heavy rain on Monday.',
                keyPoints: [],
              },
            ],
          })
          .expect(200)
      ).body;
      expect(edited.translations.map((t: any) => t.language).sort()).toEqual([
        'en',
        'hi',
      ]);
    });

    it('creates sites with one-time API keys', async () => {
      const cats = (await http.get('/api/admin/categories').set(auth())).body;
      const sports = cats.find((c: any) => c.slug === 'sports');
      const hi = await http
        .post('/api/admin/sites')
        .set(auth())
        .send({
          name: 'Khel Samachar',
          slug: 'khel',
          defaultLanguage: 'hi',
          languages: ['hi', 'en'],
          categoryIds: [sports.id],
        })
        .expect(201);
      hindiKey = hi.body.apiKey;
      expect(hindiKey).toMatch(/^nh_live_/);
      expect(hi.body.site.apiKeyHash).toBeUndefined();
      expect(hi.body.site.apiKeyPrefix).toBe(hindiKey.slice(0, 12));

      englishKey = (
        await http
          .post('/api/admin/sites')
          .set(auth())
          .send({
            name: 'World Wire',
            slug: 'world-wire',
            defaultLanguage: 'en',
            languages: ['en'],
          })
          .expect(201)
      ).body.apiKey;
      await http
        .post('/api/admin/sites')
        .set(auth())
        .send({
          name: 'Bad',
          slug: 'bad',
          defaultLanguage: 'hi',
          languages: ['en'],
        })
        .expect(400);
    });

    it('requires a valid site key', async () => {
      await http.get('/api/public/articles').expect(401);
      await http
        .get('/api/public/articles')
        .set('x-api-key', 'nh_live_wrong')
        .expect(401);
    });

    it('serves site info with localized category names', async () => {
      const res = await http
        .get('/api/public/site')
        .set('x-api-key', hindiKey)
        .expect(200);
      expect(res.body).toMatchObject({
        name: 'Khel Samachar',
        defaultLanguage: 'hi',
        categories: [{ slug: 'sports', name: 'खेल' }],
      });
      expect(res.headers['cache-control']).toContain('max-age');
    });

    it('scopes articles to the site categories and language', async () => {
      const hi = (
        await http
          .get('/api/public/articles')
          .set('x-api-key', hindiKey)
          .expect(200)
      ).body;
      expect(hi.total).toBe(1);
      expect(hi.items[0]).toMatchObject({
        language: 'hi',
        headline: 'हिंदी: Local team wins championship',
        category: { slug: 'sports', name: 'खेल' },
      });
      expect(hi.items[0].source).toEqual({
        name: 'Wire',
        url: 'https://wire.example/news/championship',
      });

      const en = (
        await http
          .get('/api/public/articles')
          .set('x-api-key', hindiKey)
          .query({ lang: 'en' })
          .expect(200)
      ).body;
      expect(en.items[0].headline).toBe('EN: Local team wins championship');

      const all = (
        await http
          .get('/api/public/articles')
          .set('x-api-key', englishKey)
          .expect(200)
      ).body;
      expect(all.total).toBe(3);
      await http
        .get('/api/public/articles')
        .set('x-api-key', englishKey)
        .query({ lang: 'hi' })
        .expect(400);
    });

    it('filters, searches and paginates', async () => {
      const page = (
        await http
          .get('/api/public/articles')
          .set('x-api-key', englishKey)
          .query({ limit: 2, page: 2 })
          .expect(200)
      ).body;
      expect(page).toMatchObject({ total: 3, page: 2, limit: 2 });
      expect(page.items).toHaveLength(1);
      const found = (
        await http
          .get('/api/public/articles')
          .set('x-api-key', englishKey)
          .query({ q: 'bike' })
          .expect(200)
      ).body;
      expect(found.items.map((a: any) => a.headline)).toEqual([
        'EN: City council approves new bike lanes',
      ]);
      const tagged = (
        await http
          .get('/api/public/articles')
          .set('x-api-key', englishKey)
          .query({ tag: 'test' })
          .expect(200)
      ).body;
      expect(tagged.total).toBe(2);
    });

    it('serves an article by slug and hides drafts', async () => {
      const detail = (
        await http
          .get('/api/public/articles/en-local-team-wins-championship')
          .set('x-api-key', hindiKey)
          .expect(200)
      ).body;
      expect(detail).toMatchObject({
        language: 'hi',
        availableLanguages: ['en', 'hi'],
        related: [],
      });

      const list = (await http.get('/api/admin/articles').set(auth())).body;
      const otters = list.items.find(
        (a: any) => a.slug === 'en-local-team-wins-championship',
      );
      await http
        .patch(`/api/admin/articles/${otters.id}`)
        .set(auth())
        .send({ status: 'draft' })
        .expect(200);
      await http
        .get('/api/public/articles/en-local-team-wins-championship')
        .set('x-api-key', hindiKey)
        .expect(404);
    });

    it('stops working after a key is rotated', async () => {
      const sites = (await http.get('/api/admin/sites').set(auth()).expect(200))
        .body;
      const ww = sites.find((s: any) => s.slug === 'world-wire');
      const rotated = (
        await http
          .post(`/api/admin/sites/${ww.id}/rotate-key`)
          .set(auth())
          .expect(200)
      ).body;
      await http
        .get('/api/public/site')
        .set('x-api-key', englishKey)
        .expect(401);
      await http
        .get('/api/public/site')
        .set('x-api-key', rotated.apiKey)
        .expect(200);
    });
  });
});
