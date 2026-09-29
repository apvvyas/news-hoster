"""Download RSS/Atom feeds and normalise their entries into FeedItems."""

from __future__ import annotations

import calendar
import logging
from datetime import datetime, timezone

import feedparser

from news_hoster import __version__
from news_hoster.config import FeedConfig
from news_hoster.models import FeedItem
from news_hoster.storage import Store
from news_hoster.text import strip_html

log = logging.getLogger(__name__)

USER_AGENT = f"news-hoster/{__version__} (+https://github.com/apvvyas/news-hoster)"


def _iso(struct_time) -> str:
    if not struct_time:
        return ""
    return datetime.fromtimestamp(calendar.timegm(struct_time), tz=timezone.utc).isoformat()


def _image(entry) -> str:
    for key in ("media_content", "media_thumbnail"):
        for media in entry.get(key, []) or []:
            if media.get("url") and media.get("medium", "image") == "image":
                return media["url"]
    for enc in entry.get("enclosures", []) or []:
        if enc.get("type", "").startswith("image/") and enc.get("href"):
            return enc["href"]
    return ""


def parse_entries(parsed, feed: FeedConfig) -> list[FeedItem]:
    items = []
    for entry in parsed.entries:
        url = entry.get("link")
        title = strip_html(entry.get("title"))
        if not url or not title:
            continue
        # Prefer the fullest body the feed gives us.
        body = ""
        if entry.get("content"):
            body = max((c.get("value", "") for c in entry.content), key=len)
        body = strip_html(body or entry.get("summary") or entry.get("description"))
        items.append(
            FeedItem(
                source=feed.name,
                feed_url=feed.url,
                category=feed.category,
                url=url,
                title=title,
                summary=body,
                author=strip_html(entry.get("author")),
                image_url=_image(entry),
                published=_iso(entry.get("published_parsed") or entry.get("updated_parsed")),
                tags=[t.get("term") for t in entry.get("tags", []) or [] if t.get("term")],
                guid=entry.get("id", ""),
            )
        )
    return items


def fetch_feed(feed: FeedConfig, store: Store) -> dict[str, int]:
    """Fetch one feed (using ETag/Last-Modified) and store its new entries."""
    etag, modified = store.get_feed_state(feed.url)
    parsed = feedparser.parse(feed.url, etag=etag, modified=modified, agent=USER_AGENT)
    counts = {"new": 0, "duplicate": 0, "seen": 0}

    status = getattr(parsed, "status", 200)
    if status == 304:
        log.info("%s: not modified", feed.name)
        return counts
    if parsed.bozo and not parsed.entries:
        raise RuntimeError(f"could not parse feed: {parsed.get('bozo_exception')}")
    if status >= 400:
        raise RuntimeError(f"HTTP {status}")

    for item in parse_entries(parsed, feed):
        counts[store.add_item(item)] += 1
    store.set_feed_state(feed.url, parsed.get("etag"), parsed.get("modified"))
    log.info("%s: %d new, %d duplicate, %d already seen", feed.name, counts["new"], counts["duplicate"], counts["seen"])
    return counts


def fetch_all(feeds: list[FeedConfig], store: Store) -> dict[str, int]:
    totals = {"new": 0, "duplicate": 0, "seen": 0, "errors": 0}
    for feed in feeds:
        try:
            for k, v in fetch_feed(feed, store).items():
                totals[k] += v
        except Exception as exc:  # one broken feed must not stop the others
            totals["errors"] += 1
            log.warning("%s (%s): %s", feed.name, feed.url, exc)
    return totals
