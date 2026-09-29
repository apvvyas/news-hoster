import { parseDocument } from 'htmlparser2';
import type { ChildNode } from 'domhandler';

const SKIP_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'iframe',
  'template',
]);
const BLOCK_TAGS = new Set([
  'p',
  'br',
  'div',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'tr',
  'section',
  'article',
]);
const TRACKING_PARAM =
  /^(utm_\w+|fbclid|gclid|mc_cid|mc_eid|ocid|cmpid|at_\w+)$/i;

/** Convert an HTML fragment to plain, whitespace-normalised text. */
export function stripHtml(value: string | null | undefined): string {
  if (!value) return '';
  const parts: string[] = [];
  const walk = (nodes: ChildNode[]) => {
    for (const node of nodes) {
      if (node.type === 'text') parts.push(node.data);
      else if (
        node.type === 'tag' ||
        node.type === 'script' ||
        node.type === 'style'
      ) {
        if (SKIP_TAGS.has(node.name)) continue;
        const block = BLOCK_TAGS.has(node.name);
        if (block) parts.push(' ');
        walk(node.children);
        if (block) parts.push(' ');
      } else if ('children' in node) walk(node.children as ChildNode[]);
    }
  };
  walk(parseDocument(value, { decodeEntities: true }).children);
  return parts.join('').replace(/\s+/g, ' ').trim();
}

/** Normalise a URL so the same story linked with tracking junk dedupes. */
export function canonicalUrl(url: string): string {
  const u = new URL(url.trim());
  u.hash = '';
  // Copy the keys first: deleting while iterating the live iterator skips entries.
  // oxlint-disable-next-line unicorn/no-useless-spread
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) u.searchParams.delete(key);
  }
  u.hostname = u.hostname.toLowerCase();
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
  return u.toString();
}

/** A loose fingerprint of a headline, used to spot the same story from two feeds. Unicode-aware. */
export function titleKey(title: string): string {
  return (
    title
      .normalize('NFKC')
      .toLowerCase()
      .match(/[\p{L}\p{M}\p{N}]+/gu) ?? []
  ).join(' ');
}

/** ASCII URL slug. Returns '' for text with no Latin characters (e.g. pure Hindi). */
export function slugify(value: string, maxLength = 80): string {
  const ascii = value.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, maxLength).replace(/-+$/, '');
}

/** Split into sentences; understands the Hindi full stop (।). */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?।])["')\]]?\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return (
    (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(
      /[,;:\s]+$/,
      '',
    ) + '…'
  );
}
