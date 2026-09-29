import json
from pathlib import Path
from types import SimpleNamespace

import feedparser
import pytest

from news_hoster.config import FeedConfig, SiteConfig, load_config
from news_hoster.fetcher import parse_entries
from news_hoster.restructure import (
    ClaudeRestructurer,
    ExtractiveRestructurer,
    restructure_pending,
)
from news_hoster.site import build_site
from news_hoster.storage import Store
from news_hoster.text import canonical_url, slugify, strip_html, title_key

FIXTURE = Path(__file__).parent / "fixtures" / "sample.xml"
CATEGORIES = ["World", "Sports", "Other"]
FEED = FeedConfig(name="Sample Wire", url="https://wire.example/rss", category="World")


@pytest.fixture
def store():
    s = Store(":memory:")
    yield s
    s.close()


@pytest.fixture
def items():
    return parse_entries(feedparser.parse(FIXTURE.read_text()), FEED)


def test_text_helpers():
    assert strip_html("<p>Hi&nbsp;<b>there</b></p><script>x()</script>") == "Hi there"
    assert canonical_url("HTTPS://Ex.com/a/?utm_source=x&id=1#frag") == "https://ex.com/a?id=1"
    assert title_key("Café – Opens!") == "cafe opens"
    assert slugify("Hello, World! Ünïcode") == "hello-world-unicode"


def test_parse_entries(items):
    assert len(items) == 2  # the entry without a link is skipped
    first = items[0]
    assert first.title == "City council approves new bike lanes"
    assert "alert" not in first.summary
    assert first.image_url == "https://wire.example/img/bikes.jpg"
    assert first.published.startswith("2026-09-28T10:00:00")
    assert first.tags == ["Transport"]


def test_store_dedupes(store, items):
    assert [store.add_item(i) for i in items] == ["new", "new"]
    assert store.add_item(items[0]) == "seen"
    # Same headline from another source counts as a duplicate story.
    other = parse_entries(feedparser.parse(FIXTURE.read_text()), FEED)[0]
    other.url, other.source = "https://other.example/bikes", "Other Wire"
    assert store.add_item(other) == "duplicate"
    assert len(store.pending_items()) == 2


def test_extractive_pipeline_and_site(tmp_path, store, items):
    for i in items:
        store.add_item(i)
    counts = restructure_pending(store, ExtractiveRestructurer(CATEGORIES))
    assert counts == {"done": 2, "failed": 0}
    assert store.pending_items() == []

    articles = store.recent_articles(10)
    assert [a.headline for a in articles][0] == "City council approves new bike lanes"
    bikes = articles[0]
    assert bikes.summary.startswith("The council voted 7-2")
    assert bikes.key_points and bikes.key_points[0] == "Officials said the plan costs $12m."
    assert bikes.source_url == "https://wire.example/news/bike-lanes?id=7"

    site = SiteConfig(title="Test News", base_url="https://news.test", output_dir=tmp_path / "out")
    build_site(articles, site, CATEGORIES)
    index = (tmp_path / "out" / "index.html").read_text()
    assert "City council approves new bike lanes" in index
    page = (tmp_path / "out" / "article" / f"{bikes.slug}.html").read_text()
    assert "Read the full story at the source" in page
    assert 'href="https://wire.example/news/bike-lanes?id=7"' in page
    assert (tmp_path / "out" / "category" / "world.html").exists()
    feed = feedparser.parse((tmp_path / "out" / "feed.xml").read_text())
    assert not feed.bozo and len(feed.entries) == 2


class FakeMessages:
    def __init__(self, payload, stop_reason="end_turn"):
        self.payload, self.stop_reason, self.calls = payload, stop_reason, []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            stop_reason=self.stop_reason,
            model=kwargs["model"],
            content=[SimpleNamespace(type="text", text=json.dumps(self.payload))],
        )


def fake_client(messages):
    return SimpleNamespace(beta=SimpleNamespace(messages=messages))


def test_claude_restructurer(store, items):
    store.add_item(items[1])
    messages = FakeMessages({
        "headline": "Rivertown Otters take regional title",
        "summary": "The Otters beat their rivals 3-1 to win the regional championship.",
        "key_points": ["Final score was 3-1", " "],
        "category": "Sports",
        "tags": ["Rivertown Otters", "football"],
    })
    r = ClaudeRestructurer("claude-opus-5-5", CATEGORIES, client=fake_client(messages))
    assert restructure_pending(store, r) == {"done": 1, "failed": 0}

    call = messages.calls[0]
    assert call["output_config"]["format"]["schema"]["properties"]["category"]["enum"] == CATEGORIES
    assert "<text>The Rivertown Otters won the regional title 3-1.</text>" in call["messages"][0]["content"]

    (a,) = store.recent_articles(5)
    assert a.slug == "rivertown-otters-take-regional-title"
    assert a.category == "Sports"
    assert a.key_points == ["Final score was 3-1"]
    assert a.tags == ["rivertown otters", "football"]
    assert a.engine == "claude:claude-opus-5-5"


def test_claude_refusal_marks_failed(store, items):
    store.add_item(items[1])
    r = ClaudeRestructurer("claude-opus-5-5", CATEGORIES, client=fake_client(FakeMessages({}, "refusal")))
    for _ in range(3):
        assert restructure_pending(store, r) == {"done": 0, "failed": 1}
    assert store.pending_items() == []  # gives up after MAX_ATTEMPTS
    assert store.stats()["failed"] == 1


def test_load_config(tmp_path):
    cfg_path = tmp_path / "feeds.toml"
    cfg_path.write_text(
        '[site]\ntitle = "X"\nbase_url = "https://x.test/"\n'
        '[[feeds]]\nname = "A"\nurl = "https://a.test/rss"\n'
    )
    cfg = load_config(cfg_path)
    assert cfg.site.base_url == "https://x.test"
    assert cfg.site.db_path == tmp_path / "data" / "news.db"
    assert cfg.restructure.engine == "auto"
    assert cfg.feeds[0].category == "Other"


def test_repo_config_loads():
    cfg = load_config(Path(__file__).parents[1] / "feeds.toml")
    assert cfg.feeds
