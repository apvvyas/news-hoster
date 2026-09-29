"""Render restructured articles into a static website (HTML pages + our own RSS feed)."""

from __future__ import annotations

import shutil
from collections import defaultdict
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path

from jinja2 import Environment, PackageLoader, select_autoescape

from news_hoster.config import SiteConfig
from news_hoster.models import Article
from news_hoster.text import slugify

STATIC_DIR = Path(__file__).parent / "static"


def _parse(ts: str) -> datetime:
    try:
        dt = datetime.fromisoformat(ts)
    except (TypeError, ValueError):
        return datetime.now(timezone.utc)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _env() -> Environment:
    env = Environment(
        loader=PackageLoader("news_hoster", "templates"),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["date"] = lambda ts: _parse(ts).strftime("%d %b %Y, %H:%M UTC")
    env.filters["isodate"] = lambda ts: _parse(ts).isoformat()
    env.filters["rfc822"] = lambda ts: format_datetime(_parse(ts))
    env.filters["slug"] = slugify
    return env


def build_site(articles: list[Article], site: SiteConfig, categories: list[str]) -> int:
    """Write the site to site.output_dir. Returns the number of files written."""
    out = Path(site.output_dir)
    if out.exists():
        shutil.rmtree(out)
    (out / "article").mkdir(parents=True)
    (out / "category").mkdir()
    shutil.copytree(STATIC_DIR, out / "static")

    env = _env()
    by_category: dict[str, list[Article]] = defaultdict(list)
    for a in articles:
        by_category[a.category].append(a)
    nav = [c for c in categories if by_category.get(c)]
    ctx = {"site": site, "nav": nav, "generated": datetime.now(timezone.utc).isoformat()}

    written = 0

    def write(rel: str, template: str, **kwargs) -> None:
        nonlocal written
        path = out / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(env.get_template(template).render(**ctx, **kwargs), encoding="utf-8")
        written += 1

    write("index.html", "index.html", articles=articles, heading="Latest news", root="")
    for category, items in by_category.items():
        write(f"category/{slugify(category)}.html", "index.html", articles=items, heading=category, root="../")
    for a in articles:
        related = [r for r in by_category[a.category] if r.id != a.id][:5]
        write(f"article/{a.slug}.html", "article.html", article=a, related=related, root="../")
    write("feed.xml", "feed.xml", articles=articles[:50])
    return written
