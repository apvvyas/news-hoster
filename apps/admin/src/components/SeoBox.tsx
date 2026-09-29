import type { VersionContent } from '@news-hoster/sdk'
import { analyzeSeo } from '../lib/seo'
import { Postbox } from './ui'

interface Props {
  version: VersionContent
  slug: string
  noindex: boolean
  canonicalUrl: string
  hasImage: boolean
  onVersion: (patch: Partial<VersionContent>) => void
  onNoindex: (v: boolean) => void
  onCanonical: (v: string) => void
}

function Meter({ len, max }: { len: number; max: number }) {
  const status = len === 0 ? 'bad' : len > max ? 'ok' : len < max * 0.5 ? 'ok' : 'good'
  return (
    <div className="meter" aria-hidden>
      <div className={status} style={{ width: `${Math.min(100, (len / max) * 100)}%` }} />
    </div>
  )
}

/** Yoast-style SEO metabox for one language version. */
export function SeoBox({ version, slug, noindex, canonicalUrl, hasImage, onVersion, onNoindex, onCanonical }: Props) {
  const a = analyzeSeo(version, slug, { noindex, hasImage })
  const label = { good: 'Good', ok: 'Needs improvement', bad: 'Problems' }[a.score]

  return (
    <Postbox
      title={
        <>
          <span className={`dot ${a.score}`} /> SEO — {label}
        </>
      }
    >
      <p className="muted">Google preview</p>
      <div className="snippet">
        <div className="url">yoursite.com › article › {slug}</div>
        <div className="title">{a.title || 'Headline'}</div>
        <div className="desc">{a.description.length > 158 ? `${a.description.slice(0, 155)}…` : a.description || 'Summary'}</div>
      </div>

      <div className="mt">
        <label className="field">
          Focus keyphrase
          <input type="text" value={version.focusKeyword} onChange={(e) => onVersion({ focusKeyword: e.target.value })} placeholder="e.g. Delhi rain" />
        </label>
        <label className="field">
          SEO title <span className="hint">Empty = headline. {version.seoTitle.length}/60</span>
          <input type="text" value={version.seoTitle} onChange={(e) => onVersion({ seoTitle: e.target.value })} placeholder={version.headline} />
          <Meter len={a.title.length} max={60} />
        </label>
        <label className="field">
          Meta description <span className="hint">Empty = summary. {version.metaDescription.length}/156</span>
          <textarea rows={3} value={version.metaDescription} onChange={(e) => onVersion({ metaDescription: e.target.value })} placeholder={version.summary} />
          <Meter len={a.description.length} max={156} />
        </label>
      </div>

      <h2 className="mt">Analysis</h2>
      <ul className="seo-checks">
        {a.checks.map((c) => (
          <li key={c.id}>
            <span className={`dot ${c.status}`} />
            {c.message}
          </li>
        ))}
      </ul>

      <details className="mt">
        <summary>Advanced (applies to all languages)</summary>
        <div className="mt">
          <label className="checkbox">
            <input type="checkbox" checked={noindex} onChange={(e) => onNoindex(e.target.checked)} /> Hide from search engines (noindex, removed from sitemap)
          </label>
          <label className="field mt">
            Canonical URL <span className="hint">Leave empty to use the article's own URL on each site.</span>
            <input type="url" value={canonicalUrl} onChange={(e) => onCanonical(e.target.value)} placeholder="https://…" />
          </label>
        </div>
      </details>
    </Postbox>
  )
}
