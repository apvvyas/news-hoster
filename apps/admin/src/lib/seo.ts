import type { VersionContent } from '@news-hoster/sdk'

export type CheckStatus = 'good' | 'ok' | 'bad'

export interface SeoCheck {
  id: string
  status: CheckStatus
  message: string
}

export interface SeoAnalysis {
  score: CheckStatus
  checks: SeoCheck[]
  /** What Google would show (after fallbacks). */
  title: string
  description: string
}

const norm = (s: string) => s.normalize('NFKC').toLowerCase()

function contains(haystack: string, needle: string): boolean {
  return Boolean(needle) && norm(haystack).includes(norm(needle))
}

function range(len: number, [min, max]: [number, number], label: string, id: string): SeoCheck {
  if (len === 0) return { id, status: 'bad', message: `${label} is empty.` }
  if (len < min) return { id, status: 'ok', message: `${label} is short (${len} chars; aim for ${min}–${max}).` }
  if (len > max) return { id, status: 'ok', message: `${label} is long (${len} chars; may be cut off after ~${max}).` }
  return { id, status: 'good', message: `${label} length is good (${len} chars).` }
}

/** Yoast-style checks for one language version of an article. */
export function analyzeSeo(v: VersionContent, slug: string, opts: { noindex: boolean; hasImage: boolean }): SeoAnalysis {
  const title = v.seoTitle || v.headline
  const description = v.metaDescription || v.summary
  const kw = v.focusKeyword.trim()
  const text = [v.summary, ...v.keyPoints, v.body].join(' ')
  const words = text.split(/\s+/).filter(Boolean).length
  const checks: SeoCheck[] = []

  if (opts.noindex) checks.push({ id: 'noindex', status: 'bad', message: 'Search engines are told not to index this article.' })

  if (!kw) {
    checks.push({ id: 'kw', status: 'bad', message: 'No focus keyphrase set.' })
  } else {
    checks.push(
      contains(title, kw)
        ? { id: 'kw-title', status: 'good', message: 'Focus keyphrase appears in the SEO title.' }
        : { id: 'kw-title', status: 'bad', message: 'Focus keyphrase is missing from the SEO title.' },
      contains(description, kw)
        ? { id: 'kw-desc', status: 'good', message: 'Focus keyphrase appears in the meta description.' }
        : { id: 'kw-desc', status: 'ok', message: 'Add the focus keyphrase to the meta description.' },
      contains(v.summary, kw)
        ? { id: 'kw-intro', status: 'good', message: 'Focus keyphrase appears in the summary (intro).' }
        : { id: 'kw-intro', status: 'ok', message: 'Use the focus keyphrase in the summary.' },
    )
    // Slugs are ASCII; only meaningful for Latin-script keyphrases.
    if (/^[\x20-\x7e]+$/.test(kw)) {
      const kwSlug = norm(kw)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      checks.push(
        slug.includes(kwSlug)
          ? { id: 'kw-slug', status: 'good', message: 'Focus keyphrase appears in the slug.' }
          : { id: 'kw-slug', status: 'ok', message: 'Consider using the focus keyphrase in the slug.' },
      )
    }
  }

  checks.push(range(title.length, [30, 60], 'SEO title', 'title-len'))
  checks.push(range(description.length, [120, 156], 'Meta description', 'desc-len'))
  if (!v.seoTitle) checks.push({ id: 'title-set', status: 'ok', message: 'No custom SEO title — the headline is used.' })
  if (!v.metaDescription) checks.push({ id: 'desc-set', status: 'ok', message: 'No custom meta description — the summary is used.' })
  checks.push(
    words >= 150
      ? { id: 'length', status: 'good', message: `Text length is good (${words} words).` }
      : { id: 'length', status: words >= 60 ? 'ok' : 'bad', message: `Text is short (${words} words). Key points or a body help readers and search engines.` },
  )
  checks.push(
    opts.hasImage
      ? { id: 'image', status: 'good', message: 'Featured image is set (used for social sharing).' }
      : { id: 'image', status: 'ok', message: 'No featured image — social shares will look plain.' },
  )

  const bad = checks.filter((c) => c.status === 'bad').length
  const ok = checks.filter((c) => c.status === 'ok').length
  const score: CheckStatus = bad > 0 ? 'bad' : ok > 2 ? 'ok' : 'good'
  const order = { bad: 0, ok: 1, good: 2 }
  checks.sort((a, b) => order[a.status] - order[b.status])
  return { score, checks, title, description }
}
