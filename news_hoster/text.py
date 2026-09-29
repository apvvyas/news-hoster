"""Small text helpers: HTML stripping, URL canonicalisation, slugs, sentence splitting."""

from __future__ import annotations

import html
import re
import unicodedata
from html.parser import HTMLParser
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

_TRACKING_PARAMS = re.compile(r"^(utm_\w+|fbclid|gclid|mc_cid|mc_eid|ocid|cmpid|at_\w+)$", re.I)
_WS = re.compile(r"\s+")
_SENTENCE_END = re.compile(r"(?<=[.!?])[\"')\]]?\s+(?=[A-Z0-9\"'(\[])")


class _TextExtractor(HTMLParser):
    _SKIP = {"script", "style", "noscript", "iframe"}
    _BLOCK = {"p", "br", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "tr"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self._SKIP:
            self._skip_depth += 1
        elif tag in self._BLOCK:
            self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in self._SKIP and self._skip_depth:
            self._skip_depth -= 1
        elif tag in self._BLOCK:
            self.parts.append(" ")

    def handle_data(self, data):
        if not self._skip_depth:
            self.parts.append(data)


def strip_html(value: str | None) -> str:
    """Convert an HTML fragment to plain, whitespace-normalised text."""
    if not value:
        return ""
    parser = _TextExtractor()
    parser.feed(value)
    parser.close()
    return _WS.sub(" ", html.unescape("".join(parser.parts))).strip()


def canonical_url(url: str) -> str:
    """Normalise a URL so the same story linked with tracking junk dedupes."""
    parts = urlsplit(url.strip())
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not _TRACKING_PARAMS.match(k)]
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, urlencode(query), ""))


def title_key(title: str) -> str:
    """A loose fingerprint of a headline, used to spot the same story from two feeds."""
    ascii_title = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    return " ".join(re.findall(r"[a-z0-9]+", ascii_title.lower()))


def slugify(value: str, max_length: int = 80) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")
    return slug[:max_length].rstrip("-") or "story"


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_END.split(text) if s.strip()]


def truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(",;:")
    return cut + "…"
