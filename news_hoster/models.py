from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class FeedItem:
    """A story as it arrived from a source feed (untrusted, third-party content)."""

    source: str
    feed_url: str
    category: str
    url: str
    title: str
    summary: str = ""
    author: str = ""
    image_url: str = ""
    published: str = ""  # ISO-8601 UTC
    tags: list[str] = field(default_factory=list)
    guid: str = ""
    id: int | None = None


@dataclass
class Article:
    """A restructured story, ready to publish on our site."""

    item_id: int
    slug: str
    headline: str
    summary: str
    key_points: list[str]
    category: str
    tags: list[str]
    engine: str
    # Joined from the source item when read back from the database.
    source: str = ""
    source_url: str = ""
    image_url: str = ""
    published: str = ""
    id: int | None = None
