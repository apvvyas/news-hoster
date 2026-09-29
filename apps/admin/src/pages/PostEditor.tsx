import { LANGUAGES, type Article, type ArticleStatus, type Language, type VersionContent } from '@news-hoster/sdk'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../api'
import { ChatPanel } from '../components/ChatPanel'
import { RevisionsBox } from '../components/RevisionsBox'
import { SeoBox } from '../components/SeoBox'
import { Notice, Postbox, Spinner } from '../components/ui'
import { errorMessage, formatDate, langName } from '../lib/format'

interface Meta {
  slug: string
  status: ArticleStatus
  categoryId: string
  tags: string[]
  imageUrl: string
  canonicalUrl: string
  noindex: boolean
}

const EMPTY: VersionContent = { headline: '', summary: '', keyPoints: [], body: '', seoTitle: '', metaDescription: '', focusKeyword: '' }

function toVersion(t: VersionContent): VersionContent {
  return {
    headline: t.headline,
    summary: t.summary,
    keyPoints: t.keyPoints,
    body: t.body ?? '',
    seoTitle: t.seoTitle ?? '',
    metaDescription: t.metaDescription ?? '',
    focusKeyword: t.focusKeyword ?? '',
  }
}

function metaOf(a: Article): Meta {
  return {
    slug: a.slug,
    status: a.status,
    categoryId: a.category?.id ?? '',
    tags: a.tags,
    imageUrl: a.imageUrl ?? '',
    canonicalUrl: a.canonicalUrl ?? '',
    noindex: a.noindex,
  }
}

function versionsOf(a: Article): Partial<Record<Language, VersionContent>> {
  return Object.fromEntries(a.translations.map((t) => [t.language, toVersion(t)]))
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function PostEditorPage() {
  const { id = '' } = useParams()
  const article = useQuery({ queryKey: ['article', id], queryFn: () => api.articles.get(id) })
  if (article.isLoading) return <Spinner />
  if (article.error || !article.data) return <Notice type="error">{errorMessage(article.error)}</Notice>
  // Keyed by id so local edit state starts fresh for each article.
  return <Editor key={id} id={id} server={article.data} />
}

function Editor({ id, server }: { id: string; server: Article }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories.list })

  const [meta, setMeta] = useState<Meta>(() => metaOf(server))
  const [versions, setVersions] = useState<Partial<Record<Language, VersionContent>>>(() => versionsOf(server))
  const [lang, setLang] = useState<Language>(() => (server.translations.some((t) => t.language === 'en') ? 'en' : server.translations[0].language))
  const [tagInput, setTagInput] = useState('')
  const [notice, setNotice] = useState('')

  const serverVersions = useMemo(() => versionsOf(server), [server])
  const dirtyLangs = LANGUAGES.filter((l) => versions[l] && !same(versions[l], serverVersions[l]))
  const metaDirty = !same(meta, metaOf(server))
  const dirty = metaDirty || dirtyLangs.length > 0

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  /** Pull the server copy of one language (after a chat apply or revision restore). */
  const reloadVersion = async (l: Language) => {
    // Always hit the server: the cached copy is still "fresh" but predates the change.
    const fresh = await api.articles.get(id)
    qc.setQueryData(['article', id], fresh)
    const v = fresh.translations.find((t) => t.language === l)
    setVersions((prev) => ({ ...prev, [l]: v ? toVersion(v) : prev[l] }))
    qc.invalidateQueries({ queryKey: ['revisions', id, l] })
  }

  const save = useMutation({
    mutationFn: (overrides: Partial<Meta> = {}) => {
      const m = { ...meta, ...overrides }
      return api.articles.update(id, {
        slug: m.slug,
        status: m.status,
        categoryId: m.categoryId || null,
        tags: m.tags,
        imageUrl: m.imageUrl || null,
        canonicalUrl: m.canonicalUrl || null,
        noindex: m.noindex,
        translations: dirtyLangs.map((l) => ({ language: l, ...versions[l]! })),
      })
    },
    onSuccess: (a) => {
      qc.setQueryData(['article', id], a)
      setMeta(metaOf(a))
      setVersions(versionsOf(a))
      setNotice(a.status === 'published' ? 'Post updated and published.' : a.status === 'trash' ? 'Post moved to the Trash.' : 'Post saved.')
      for (const l of LANGUAGES) qc.invalidateQueries({ queryKey: ['revisions', id, l] })
      qc.invalidateQueries({ queryKey: ['articles'] })
      qc.invalidateQueries({ queryKey: ['article-counts'] })
    },
  })

  const v = versions[lang] ?? EMPTY
  const setV = (patch: Partial<VersionContent>) => setVersions((prev) => ({ ...prev, [lang]: { ...(prev[lang] ?? EMPTY), ...patch } }))
  const setM = (patch: Partial<Meta>) => setMeta((prev) => ({ ...prev, ...patch }))
  const missing = LANGUAGES.filter((l) => !versions[l])
  const addTags = () => {
    const extra = tagInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    setM({ tags: [...new Set([...meta.tags, ...extra])] })
    setTagInput('')
  }

  return (
    <>
      <div className="page-header">
        <h1>Edit Post</h1>
        <Link className="page-title-action" to="/posts">
          ← All Posts
        </Link>
      </div>
      {notice && (
        <Notice type="success" onDismiss={() => setNotice('')}>
          {notice}
        </Notice>
      )}
      {save.error && <Notice type="error">{errorMessage(save.error)}</Notice>}
      {server.status === 'trash' && <Notice type="warning">This post is in the Trash.</Notice>}

      <div className="post-body">
        {/* ---- Main column ---- */}
        <div>
          <div className="lang-tabs" role="tablist">
            {LANGUAGES.filter((l) => versions[l]).map((l) => (
              <button key={l} role="tab" aria-selected={l === lang} className={l === lang ? 'active' : ''} onClick={() => setLang(l)}>
                {langName(l)} {dirtyLangs.includes(l) && '•'}
              </button>
            ))}
            {missing.map((l) => (
              <button
                key={l}
                onClick={() => {
                  setVersions((prev) => ({ ...prev, [l]: { ...EMPTY } }))
                  setLang(l)
                }}
              >
                + Add {langName(l)} version
              </button>
            ))}
          </div>

          <div className="titlediv">
            <input
              type="text"
              value={v.headline}
              onChange={(e) => setV({ headline: e.target.value })}
              placeholder="Add headline"
              aria-label="Headline"
              lang={lang}
            />
          </div>
          <div className="permalink">
            <strong>Permalink:</strong> /article/
            <input
              type="text"
              value={meta.slug}
              onChange={(e) => setM({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
              aria-label="Slug"
              style={{ minWidth: 280 }}
            />
          </div>

          <Postbox title="Summary">
            <textarea rows={4} value={v.summary} onChange={(e) => setV({ summary: e.target.value })} lang={lang} aria-label="Summary" />
          </Postbox>
          <Postbox title="Key points">
            <textarea
              rows={5}
              value={v.keyPoints.join('\n')}
              onChange={(e) => setV({ keyPoints: e.target.value.split('\n') })}
              lang={lang}
              aria-label="Key points"
            />
            <p className="description">One point per line.</p>
          </Postbox>
          <Postbox title="Body (optional)">
            <textarea rows={8} value={v.body} onChange={(e) => setV({ body: e.target.value })} lang={lang} aria-label="Body" />
            <p className="description">Longer write-up. Separate paragraphs with a blank line. Stay within what the source reports.</p>
          </Postbox>

          <SeoBox
            version={v}
            slug={meta.slug}
            noindex={meta.noindex}
            canonicalUrl={meta.canonicalUrl}
            hasImage={Boolean(meta.imageUrl)}
            onVersion={setV}
            onNoindex={(noindex) => setM({ noindex })}
            onCanonical={(canonicalUrl) => setM({ canonicalUrl })}
          />

          {serverVersions[lang] && <RevisionsBox articleId={id} language={lang} onRestored={() => reloadVersion(lang)} />}
        </div>

        {/* ---- Sidebar ---- */}
        <div>
          <div className="postbox">
            <div className="postbox-header">
              <h2>Publish</h2>
            </div>
            <div className="inside misc-pub">
              <label className="inline">
                Status:
                <select value={meta.status} onChange={(e) => setM({ status: e.target.value as ArticleStatus })}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="rejected">Rejected</option>
                  {meta.status === 'trash' && <option value="trash">Trash</option>}
                </select>
              </label>
              <span>
                Published on: <strong>{formatDate(server.publishedAt)}</strong>
              </span>
              <span>
                Original language: <strong>{langName(server.sourceLanguage)}</strong>
              </span>
              <span className="muted">Written by: {server.engine}</span>
              {dirty && <span className="danger">You have unsaved changes{dirtyLangs.length ? ` (${dirtyLangs.map(langName).join(', ')})` : ''}.</span>}
            </div>
            <div className="major-publishing">
              {server.status === 'trash' ? (
                <button className="button-link" onClick={() => save.mutate({ status: 'draft' })}>
                  Restore
                </button>
              ) : (
                <button className="button-link danger" onClick={() => save.mutate({ status: 'trash' }, { onSuccess: () => navigate('/posts') })}>
                  Move to Trash
                </button>
              )}
              <div className="inline">
                {meta.status !== 'published' && (
                  <button className="button" disabled={save.isPending} onClick={() => save.mutate({})}>
                    Save
                  </button>
                )}
                <button
                  className="button button-primary"
                  disabled={save.isPending}
                  onClick={() => save.mutate(meta.status === 'published' ? {} : { status: 'published' })}
                >
                  {save.isPending ? 'Saving…' : meta.status === 'published' ? 'Update' : 'Publish'}
                </button>
              </div>
            </div>
          </div>

          {serverVersions[lang] ? (
            <ChatPanel articleId={id} language={lang} current={serverVersions[lang]!} dirty={dirtyLangs.includes(lang)} onApplied={() => reloadVersion(lang)} />
          ) : (
            <Postbox title="Editorial assistant">
              <p className="muted">Save this new {langName(lang)} version first, then chat with the assistant about it.</p>
            </Postbox>
          )}

          <Postbox title="Categories">
            <div className="category-checklist" role="radiogroup">
              <label>
                <input type="radio" name="cat" checked={!meta.categoryId} onChange={() => setM({ categoryId: '' })} /> (none)
              </label>
              {categories.data?.map((c) => (
                <label key={c.id}>
                  <input type="radio" name="cat" checked={meta.categoryId === c.id} onChange={() => setM({ categoryId: c.id })} />
                  {c.names.en} {c.names.hi && <span className="muted">· {c.names.hi}</span>}
                </label>
              ))}
            </div>
          </Postbox>

          <Postbox title="Tags">
            <div className="inline">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTags()
                  }
                }}
                placeholder="Add tags, comma separated"
                aria-label="New tags"
              />
              <button className="button" onClick={addTags}>
                Add
              </button>
            </div>
            <div className="tagchecklist">
              {meta.tags.map((t) => (
                <span key={t}>
                  <button onClick={() => setM({ tags: meta.tags.filter((x) => x !== t) })} aria-label={`Remove tag ${t}`}>
                    ⊗
                  </button>
                  {t}
                </span>
              ))}
            </div>
          </Postbox>

          <Postbox title="Featured image">
            <div className="featured-image">
              {meta.imageUrl && <img src={meta.imageUrl} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />}
              <input
                type="url"
                value={meta.imageUrl}
                onChange={(e) => setM({ imageUrl: e.target.value })}
                placeholder="https://… image URL"
                aria-label="Featured image URL"
                style={{ width: '100%' }}
              />
            </div>
          </Postbox>

          <Postbox title="Source">
            <p>
              <strong>{server.sourceName}</strong>
              {server.sourceUrl && (
                <>
                  {' '}
                  ·{' '}
                  <a href={server.sourceUrl} target="_blank" rel="noreferrer">
                    Original article ↗
                  </a>
                </>
              )}
            </p>
            {server.item && (
              <details>
                <summary>Text from the feed (for fact-checking)</summary>
                <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>
                  <strong>{server.item.title}</strong>
                  {'\n'}
                  {server.item.content || '(no text in feed)'}
                </p>
              </details>
            )}
          </Postbox>
        </div>
      </div>
    </>
  )
}
