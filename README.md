# News Hoster

Collects news from RSS feeds (English and Hindi), restructures every story with
**Sarvam AI** into our own bilingual copy with SEO metadata, lets editors review it
in a **WordPress-style admin**, and serves it to our public websites through a
read-only **content API**.

```
 RSS feeds ─► fetch ─► dedupe ─► detect language ─► Sarvam rewrite (EN + HI, SEO)
                                                         │
                         PostgreSQL ◄────────────────────┘
                             │
      ┌──────────────────────┼──────────────────────────┐
  Admin (React)        Admin API (JWT)         Public API (per-site key)
  apps/admin           /api/admin/*            /api/public/*  ◄── 5 React websites
                                                                  (packages/sdk)
```

| Path | What it is |
|---|---|
| `apps/api` | NestJS 12 API: ingestion pipeline, admin API, public API (PostgreSQL + TypeORM) |
| `apps/admin` | React + Vite admin panel styled after wp-admin |
| `packages/sdk` | Typed client (`createNewsClient`, `createAdminClient`) shared by the admin and the websites |

## Features

- **Ingestion**: RSS/Atom feeds with per-feed intervals and conditional GET (ETag /
  Last-Modified). Tracking parameters are stripped, the same headline from two outlets
  is kept once, and Hindi vs. English is detected per story (or pinned per feed).
- **Restructuring with Sarvam** (`sarvam-105b`, strict JSON schema): every story is
  rewritten, not translated literally, into each target language (English + Hindi by
  default). Sarvam also writes an SEO title, meta description and focus keyphrase,
  picks a category and adds tags. The prompt forbids adding facts that aren't in the
  source. Without a Sarvam key an extractive fallback cleans up the feed text.
- **WordPress-style admin**:
  - A Posts list with All / Published / Drafts / Rejected / Trash, bulk and row actions,
    search and a category filter.
  - A two-column editor with a Publish box, Categories, Tags, Featured image and Source
    (the original feed text, for fact-checking).
- **SEO**: a Yoast-style box per language version, with a Google snippet preview,
  keyphrase and length checks, noindex and a canonical URL. The public API returns ready
  `seo` fields and a sitemap.
- **Revisions**: every change to a language version (pipeline, manual edit, applied
  suggestion, restore) is saved and can be viewed and restored.
- **Editorial chat per version**: editors ask Sarvam for changes to one language version
  ("शीर्षक छोटा करें", "make it more formal", "improve SEO"). Sarvam replies with a full
  proposed version, shown as a diff, that can be applied with one click (saved as a revision).
- **Multi-site**: each website has its own API key (stored hashed, shown once), its
  languages and its categories. Keys can be rotated.
- **Roles**: *admin* manages everything; *editor* manages posts, feeds and categories.

## Quick start (local)

Requirements: Node 22.13+, and PostgreSQL 16 (Docker works).

```bash
docker compose up -d                 # PostgreSQL on :5432 (+ a news_hoster_test DB)
npm ci
cp apps/api/.env.example apps/api/.env   # set ADMIN_EMAIL / ADMIN_PASSWORD, SARVAM_API_KEY
npm run build -w packages/sdk
npm run dev:api                      # http://localhost:3000/api  (docs: /api/docs)
npm run dev:admin                    # http://localhost:5173  (proxies /api to :3000)
```

Migrations run automatically on API start. The first admin account is created from
`ADMIN_EMAIL` / `ADMIN_PASSWORD` when the users table is empty. Ten starter categories
with English and Hindi names are seeded.

Then in the admin: **Feeds → Add New Feed**, **Dashboard → Run now**, review drafts under
**Posts**, and create a key for each website under **Sites**.

### Configuration (`apps/api/.env`)

See [`apps/api/.env.example`](apps/api/.env.example). The important ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Required in production; a long random string |
| `SARVAM_API_KEY` | Enables Sarvam restructuring and the editorial assistant |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First admin account (only when no users exist) |
| `CORS_ORIGINS` | Comma-separated origins of the admin and websites |
| `PIPELINE_INTERVAL_MINUTES` | Fetch + restructure schedule (`0` = manual only) |

Pipeline behaviour (engine, target languages, auto-publish, batch size) is edited in
**Settings** in the admin.

## Using the API from a website

```ts
import { createNewsClient } from '@news-hoster/sdk'

const news = createNewsClient({ baseUrl: 'https://api.example.com', apiKey: import.meta.env.VITE_SITE_KEY })

const site = await news.site()                                   // name, languages, localized categories
const page = await news.articles({ category: 'sports', lang: 'hi', page: 1, limit: 12 })
const story = await news.article('otters-win', 'hi')             // + body, related, seo
const urls = await news.sitemap()                                // for sitemap.xml
```

Every article includes `seo.title`, `seo.description`, `seo.canonicalUrl` and
`seo.noindex` for the page `<head>`, plus `source` for attribution. A site only receives
**published** articles in its categories and languages. The site key identifies the
site and is visible in browser code, so treat it as public. The API it unlocks is
read-only and serves only published content.

Full reference: Swagger UI at `/api/docs`.

### Live demo build

`npm run build:demo -w apps/admin` builds the admin into `apps/admin/dist-demo` with an
in-browser sample API (fictional bilingual stories, simulated Sarvam replies, data kept in
the viewer's browser). It needs no server and is useful for showing the admin to people.

## Development

```bash
npm test                          # API unit + e2e tests (e2e needs PostgreSQL, see below)
npm run lint                      # API lint, admin + SDK typecheck
npm run migration:generate -w apps/api -- src/database/migrations/Name   # after entity changes
```

- E2E tests use `TEST_DATABASE_URL` (default
  `postgres://news:news@localhost:5432/news_hoster_test`) and **wipe that database's
  schema** on each run. They fake Sarvam and serve fixture feeds from a local HTTP
  server, so they need no network access.
- New migrations must be registered in `apps/api/src/database/migrations/index.ts`
  (ESM builds cannot glob-load them). CI fails if entities and migrations drift.
- Use npm 11 (`npx npm@11 install <pkg>`) when adding dependencies. npm 10 crashes
  resolving this workspace's peer dependencies (`npm ci` is fine).

## Deployment

The API is a long-running Node.js process (it schedules feed fetching) that needs
PostgreSQL. The admin and the websites are static builds (`npm run build -w apps/admin`
→ `apps/admin/dist`) that any web host can serve. `apps/admin/public/.htaccess` adds
the single-page-app fallback for Apache/LiteSpeed.

## Content & legal

Stories are rewritten from what publishers put in their RSS feeds and always credit and
link to the source. Check each feed's terms before adding it. Images are loaded from the
source URLs.
