"""SQLite persistence for fetched feed items and restructured articles."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from news_hoster.models import Article, FeedItem
from news_hoster.text import canonical_url, slugify, title_key

MAX_ATTEMPTS = 3

SCHEMA = """
CREATE TABLE IF NOT EXISTS feed_state (
    url TEXT PRIMARY KEY,
    etag TEXT,
    modified TEXT,
    last_fetched TEXT
);

CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL,
    feed_url TEXT NOT NULL,
    category TEXT NOT NULL,
    guid TEXT,
    url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    title_key TEXT NOT NULL,
    summary TEXT,
    author TEXT,
    image_url TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    published TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',   -- pending | done | duplicate | failed
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT
);
CREATE INDEX IF NOT EXISTS items_status ON items(status);
CREATE INDEX IF NOT EXISTS items_title_key ON items(title_key);

CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY,
    item_id INTEGER NOT NULL UNIQUE REFERENCES items(id),
    slug TEXT NOT NULL UNIQUE,
    headline TEXT NOT NULL,
    summary TEXT NOT NULL,
    key_points TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT NOT NULL,
    engine TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class Store:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        if str(path) != ":memory:":
            self.path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(path))
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript(SCHEMA)

    def close(self) -> None:
        self.db.close()

    # --- feed conditional-GET state -------------------------------------------------

    def get_feed_state(self, url: str) -> tuple[str | None, str | None]:
        row = self.db.execute("SELECT etag, modified FROM feed_state WHERE url = ?", (url,)).fetchone()
        return (row["etag"], row["modified"]) if row else (None, None)

    def set_feed_state(self, url: str, etag: str | None, modified: str | None) -> None:
        with self.db:
            self.db.execute(
                "INSERT INTO feed_state(url, etag, modified, last_fetched) VALUES (?, ?, ?, ?) "
                "ON CONFLICT(url) DO UPDATE SET etag=excluded.etag, modified=excluded.modified, "
                "last_fetched=excluded.last_fetched",
                (url, etag, modified, utcnow()),
            )

    # --- items ----------------------------------------------------------------------

    def add_item(self, item: FeedItem) -> str:
        """Insert a feed item. Returns 'new', 'duplicate' (same story, other source) or 'seen'."""
        url = canonical_url(item.url)
        key = title_key(item.title)
        if self.db.execute("SELECT 1 FROM items WHERE url = ?", (url,)).fetchone():
            return "seen"
        # Same headline already collected from another source -> keep it for the record
        # but don't publish it twice.
        dup = self.db.execute(
            "SELECT 1 FROM items WHERE title_key = ? AND status != 'duplicate'", (key,)
        ).fetchone()
        status = "duplicate" if dup and key else "pending"
        with self.db:
            cur = self.db.execute(
                "INSERT INTO items(source, feed_url, category, guid, url, title, title_key, summary, "
                "author, image_url, tags, published, fetched_at, status) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    item.source, item.feed_url, item.category, item.guid, url, item.title, key,
                    item.summary, item.author, item.image_url, json.dumps(item.tags),
                    item.published or utcnow(), utcnow(), status,
                ),
            )
        item.id = cur.lastrowid
        return "new" if status == "pending" else "duplicate"

    def pending_items(self, limit: int | None = None) -> list[FeedItem]:
        sql = "SELECT * FROM items WHERE status = 'pending' AND attempts < ? ORDER BY published DESC"
        params: tuple = (MAX_ATTEMPTS,)
        if limit:
            sql += " LIMIT ?"
            params += (limit,)
        return [self._row_to_item(r) for r in self.db.execute(sql, params)]

    def mark_failed(self, item_id: int, error: str) -> None:
        with self.db:
            self.db.execute(
                "UPDATE items SET attempts = attempts + 1, error = ?, "
                "status = CASE WHEN attempts + 1 >= ? THEN 'failed' ELSE status END WHERE id = ?",
                (error[:1000], MAX_ATTEMPTS, item_id),
            )

    @staticmethod
    def _row_to_item(row: sqlite3.Row) -> FeedItem:
        return FeedItem(
            id=row["id"], source=row["source"], feed_url=row["feed_url"], category=row["category"],
            url=row["url"], title=row["title"], summary=row["summary"] or "", author=row["author"] or "",
            image_url=row["image_url"] or "", published=row["published"], tags=json.loads(row["tags"]),
            guid=row["guid"] or "",
        )

    # --- articles -------------------------------------------------------------------

    def save_article(self, article: Article) -> Article:
        article.slug = self._unique_slug(article.slug or slugify(article.headline))
        with self.db:
            cur = self.db.execute(
                "INSERT INTO articles(item_id, slug, headline, summary, key_points, category, tags, "
                "engine, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    article.item_id, article.slug, article.headline, article.summary,
                    json.dumps(article.key_points), article.category, json.dumps(article.tags),
                    article.engine, utcnow(),
                ),
            )
            self.db.execute("UPDATE items SET status = 'done', error = NULL WHERE id = ?", (article.item_id,))
        article.id = cur.lastrowid
        return article

    def _unique_slug(self, slug: str) -> str:
        candidate, n = slug, 2
        while self.db.execute("SELECT 1 FROM articles WHERE slug = ?", (candidate,)).fetchone():
            candidate, n = f"{slug}-{n}", n + 1
        return candidate

    def recent_articles(self, limit: int) -> list[Article]:
        rows = self.db.execute(
            "SELECT a.*, i.source, i.url AS source_url, i.image_url, i.published "
            "FROM articles a JOIN items i ON i.id = a.item_id "
            "ORDER BY i.published DESC, a.id DESC LIMIT ?",
            (limit,),
        )
        return [
            Article(
                id=r["id"], item_id=r["item_id"], slug=r["slug"], headline=r["headline"],
                summary=r["summary"], key_points=json.loads(r["key_points"]), category=r["category"],
                tags=json.loads(r["tags"]), engine=r["engine"], source=r["source"],
                source_url=r["source_url"], image_url=r["image_url"] or "", published=r["published"],
            )
            for r in rows
        ]

    def stats(self) -> dict[str, int]:
        counts = {r["status"]: r["n"] for r in self.db.execute("SELECT status, COUNT(*) n FROM items GROUP BY status")}
        counts["articles"] = self.db.execute("SELECT COUNT(*) FROM articles").fetchone()[0]
        return counts
