"""Command line entry point: news-hoster [fetch|restructure|build|run|stats]."""

from __future__ import annotations

import argparse
import http.server
import logging
import functools

from news_hoster.config import load_config
from news_hoster.fetcher import fetch_all
from news_hoster.restructure import build_restructurer, restructure_pending
from news_hoster.site import build_site
from news_hoster.storage import Store

log = logging.getLogger("news_hoster")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="news-hoster", description=__doc__)
    parser.add_argument("-c", "--config", default="feeds.toml", help="path to feeds.toml")
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("fetch", help="download all feeds and store new stories")
    p_re = sub.add_parser("restructure", help="rewrite pending stories into articles")
    p_re.add_argument("--limit", type=int, help="max stories to process this run")
    sub.add_parser("build", help="render the static site")
    p_run = sub.add_parser("run", help="fetch + restructure + build")
    p_run.add_argument("--limit", type=int, help="max stories to restructure this run")
    sub.add_parser("stats", help="show counts from the database")
    p_serve = sub.add_parser("serve", help="preview the built site locally")
    p_serve.add_argument("--port", type=int, default=8000)
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    # The HTTP client libraries are noisy at INFO.
    for noisy in ("httpx", "anthropic"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    cfg = load_config(args.config)

    if args.command == "serve":
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(cfg.site.output_dir))
        log.info("Serving %s at http://localhost:%d/", cfg.site.output_dir, args.port)
        http.server.ThreadingHTTPServer(("", args.port), handler).serve_forever()
        return 0

    store = Store(cfg.site.db_path)
    try:
        if args.command in ("fetch", "run"):
            log.info("Fetch: %s", fetch_all(cfg.feeds, store))
        if args.command in ("restructure", "run"):
            restructurer = build_restructurer(cfg.restructure)
            log.info("Restructure: %s", restructure_pending(store, restructurer, args.limit))
        if args.command in ("build", "run"):
            articles = store.recent_articles(cfg.site.max_articles)
            n = build_site(articles, cfg.site, cfg.restructure.categories)
            log.info("Build: wrote %d files for %d articles to %s", n, len(articles), cfg.site.output_dir)
        if args.command == "stats":
            for k, v in sorted(store.stats().items()):
                print(f"{k:>10}: {v}")
    finally:
        store.close()
    return 0
