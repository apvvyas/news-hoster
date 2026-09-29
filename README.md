# news-hoster

Collects news from RSS feeds of different websites, restructures each story into
our own format (new headline, summary, key points, category, tags) and publishes
it as a static website with its own RSS feed.

```
 RSS feeds ──► fetch ──► dedupe ──► restructure ──► static site (HTML + feed.xml)
 (feeds.toml)   │          │         (Claude or       public/
                ▼          ▼          extractive)
             SQLite: data/news.db (items, articles, feed ETags)
```

## Quick start

```bash
pip install -e '.[dev]'
export ANTHROPIC_API_KEY=...        # optional – enables Claude rewriting
news-hoster run                     # fetch + restructure + build
news-hoster serve                   # preview at http://localhost:8000
```

Individual steps: `news-hoster fetch`, `news-hoster restructure [--limit N]`,
`news-hoster build`, `news-hoster stats`. Use `-c path/to/feeds.toml` for another config.

## Configuration

Everything lives in [`feeds.toml`](feeds.toml): site title/URL, the list of feeds
(`name`, `url`, `category` hint), and the restructuring engine:

| engine       | what it does |
|--------------|--------------|
| `auto`       | Claude if `ANTHROPIC_API_KEY` is set, otherwise extractive (default) |
| `claude`     | Rewrites each story in original wording with the Claude API (`claude-opus-5-5`, low effort, JSON-schema structured output). Also re-classifies into your category list. |
| `extractive` | No LLM: cleans the feed text, uses the first sentences as summary and the rest as key points. |

## How it works

- **Fetch** (`news_hoster/fetcher.py`) – `feedparser` with ETag/Last-Modified so
  unchanged feeds cost nothing. One failing feed never stops the others.
- **Dedupe** (`news_hoster/storage.py`) – URLs are canonicalised (tracking params
  stripped); the same headline arriving from a second source is stored as a
  `duplicate` and not published twice.
- **Restructure** (`news_hoster/restructure.py`) – only uses what the publisher put
  in its feed; the prompt forbids adding facts and treats story text as data, not
  instructions. Failures are retried up to 3 times; rate limits / outages stop the
  run and leave stories pending for next time.
- **Build** (`news_hoster/site.py`, `news_hoster/templates/`) – index, one page per
  category and per article, plus `feed.xml`. Every article credits and links to the
  original source.

## Deployment

`.github/workflows/publish.yml` runs hourly on GitHub Actions and deploys to GitHub
Pages (setup steps are in the file header). The database is carried between runs
with the Actions cache. Any static host (Netlify, S3, nginx) works too – just serve
`public/`.

## Legal note

Republishing other sites' content is subject to copyright and each site's terms.
This project is designed to publish **short, rewritten summaries with attribution
and a link back**, not to copy full articles. Check the terms of every feed you add,
and prefer feeds whose publishers permit this kind of use. Article images are
hot-linked from the source; remove `image_url` from the templates if a publisher
does not allow that.

## Tests

```bash
pytest -q
```
Tests use a local fixture feed and a fake Claude client, so they need no network or API key.
