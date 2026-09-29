"""Load the TOML configuration file (feeds.toml)."""

from __future__ import annotations

import tomllib
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_CATEGORIES = ["World", "Technology", "Business", "Science", "Sports", "Entertainment", "Other"]


@dataclass(frozen=True)
class FeedConfig:
    name: str
    url: str
    category: str = "Other"


@dataclass(frozen=True)
class SiteConfig:
    title: str = "News Hoster"
    description: str = ""
    base_url: str = "http://localhost:8000"
    output_dir: Path = Path("public")
    db_path: Path = Path("data/news.db")
    max_articles: int = 300


@dataclass(frozen=True)
class RestructureConfig:
    engine: str = "auto"  # auto | claude | extractive
    model: str = "claude-opus-5-5"
    categories: list[str] = field(default_factory=lambda: list(DEFAULT_CATEGORIES))


@dataclass(frozen=True)
class Config:
    site: SiteConfig
    restructure: RestructureConfig
    feeds: list[FeedConfig]


def load_config(path: str | Path) -> Config:
    path = Path(path)
    with path.open("rb") as fh:
        raw = tomllib.load(fh)

    # Relative paths in the config are resolved against the config file's directory.
    base = path.parent
    site_raw = raw.get("site", {})
    site = SiteConfig(
        title=site_raw.get("title", SiteConfig.title),
        description=site_raw.get("description", SiteConfig.description),
        base_url=site_raw.get("base_url", SiteConfig.base_url).rstrip("/"),
        output_dir=base / site_raw.get("output_dir", SiteConfig.output_dir),
        db_path=base / site_raw.get("db_path", SiteConfig.db_path),
        max_articles=int(site_raw.get("max_articles", SiteConfig.max_articles)),
    )

    restructure = RestructureConfig(**raw.get("restructure", {}))
    if restructure.engine not in {"auto", "claude", "extractive"}:
        raise ValueError(f"restructure.engine must be auto, claude or extractive, got {restructure.engine!r}")

    feeds = [FeedConfig(**f) for f in raw.get("feeds", [])]
    if not feeds:
        raise ValueError(f"{path} does not define any [[feeds]]")
    return Config(site=site, restructure=restructure, feeds=feeds)
