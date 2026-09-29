import type { Article, ArticleStatus } from '@news-hoster/sdk'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api'
import { Notice, PageHeader, Pagination, Spinner, StatusLinks } from '../components/ui'
import { errorMessage, formatDate, headlineOf } from '../lib/format'
import { analyzeSeo } from '../lib/seo'

type Filter = 'all' | ArticleStatus
const LIMIT = 20

function seoScore(a: Article) {
  const t = a.translations.find((x) => x.language === 'en') ?? a.translations[0]
  return t ? analyzeSeo(t, a.slug, { noindex: a.noindex, hasImage: Boolean(a.imageUrl) }).score : 'bad'
}

export function PostsPage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') === 'publish' ? 'published' : params.get('status')) as Filter | null
  const filter: Filter = status ?? 'all'
  const page = Number(params.get('page') ?? 1)
  const [q, setQ] = useState(params.get('q') ?? '')
  const [categoryId, setCategoryId] = useState(params.get('category') ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulk, setBulk] = useState('')
  const [notice, setNotice] = useState('')

  const setParam = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next)
    setSelected(new Set())
  }

  const counts = useQuery({ queryKey: ['article-counts'], queryFn: api.articles.counts })
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories.list })
  const list = useQuery({
    queryKey: ['articles', filter, page, params.get('q'), params.get('category')],
    queryFn: () =>
      api.articles.list({
        status: filter === 'all' ? undefined : filter,
        page,
        limit: LIMIT,
        q: params.get('q') ?? undefined,
        categoryId: params.get('category') ?? undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['articles'] })
    qc.invalidateQueries({ queryKey: ['article-counts'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const setStatus = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: ArticleStatus }) => api.articles.bulkStatus(ids, status),
    onSuccess: (r, v) => {
      setNotice(
        `${r.updated} post(s) ${v.status === 'trash' ? 'moved to the Trash' : v.status === 'draft' && filter === 'trash' ? 'restored from the Trash' : `marked ${v.status}`}.`,
      )
      setSelected(new Set())
      refresh()
    },
  })
  const destroy = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await api.articles.remove(id)
      return ids.length
    },
    onSuccess: (n) => {
      setNotice(`${n} post(s) permanently deleted.`)
      setSelected(new Set())
      refresh()
    },
  })

  const c = counts.data
  const items = list.data?.items ?? []
  const allChecked = items.length > 0 && items.every((a) => selected.has(a.id))

  const applyBulk = () => {
    const ids = [...selected]
    if (!ids.length || !bulk) return
    if (bulk === 'delete') {
      if (confirm(`Permanently delete ${ids.length} post(s)? This cannot be undone.`)) destroy.mutate(ids)
    } else setStatus.mutate({ ids, status: bulk as ArticleStatus })
  }

  return (
    <>
      <PageHeader title="Posts" />
      {notice && (
        <Notice type="success" onDismiss={() => setNotice('')}>
          {notice}
        </Notice>
      )}
      {(setStatus.error || destroy.error) && <Notice type="error">{errorMessage(setStatus.error ?? destroy.error)}</Notice>}

      <StatusLinks<Filter>
        current={filter}
        onSelect={(k) => setParam({ status: k === 'all' ? null : k, page: null })}
        items={[
          { key: 'all', label: 'All', count: c?.all },
          { key: 'published', label: 'Published', count: c?.published },
          { key: 'draft', label: 'Drafts', count: c?.draft },
          { key: 'rejected', label: 'Rejected', count: c?.rejected },
          { key: 'trash', label: 'Trash', count: c?.trash },
        ]}
      />

      <div className="tablenav">
        <div className="actions">
          <select value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="Bulk actions">
            <option value="">Bulk actions</option>
            {filter === 'trash' ? (
              <>
                <option value="draft">Restore</option>
                <option value="delete">Delete permanently</option>
              </>
            ) : (
              <>
                <option value="published">Publish</option>
                <option value="draft">Move to drafts</option>
                <option value="rejected">Reject</option>
                <option value="trash">Move to Trash</option>
              </>
            )}
          </select>
          <button className="button" onClick={applyBulk} disabled={!selected.size || !bulk}>
            Apply
          </button>
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setParam({ category: e.target.value || null, page: null })
            }}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.data?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.names.en}
              </option>
            ))}
          </select>
        </div>
        <form
          className="actions"
          onSubmit={(e) => {
            e.preventDefault()
            setParam({ q: q || null, page: null })
          }}
        >
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search headlines" aria-label="Search posts" />
          <button className="button">Search Posts</button>
        </form>
      </div>

      <div className="table-wrap">
        <table className="wp-list-table">
          <thead>
            <tr>
              <th className="check-column">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={() => setSelected(allChecked ? new Set() : new Set(items.map((a) => a.id)))}
                  aria-label="Select all"
                />
              </th>
              <th>Title</th>
              <th className="hide-mobile">Languages</th>
              <th>Category</th>
              <th className="hide-mobile">Tags</th>
              <th className="hide-mobile">Source</th>
              <th className="hide-mobile" title="SEO score (English or first version)">
                SEO
              </th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading && (
              <tr>
                <td colSpan={8} className="empty">
                  <Spinner />
                </td>
              </tr>
            )}
            {!list.isLoading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  No posts found{filter === 'trash' ? ' in Trash' : ''}.
                </td>
              </tr>
            )}
            {items.map((a) => (
              <tr key={a.id}>
                <td className="check-column">
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => {
                      const next = new Set(selected)
                      if (next.has(a.id)) next.delete(a.id)
                      else next.add(a.id)
                      setSelected(next)
                    }}
                    aria-label={`Select ${headlineOf(a)}`}
                  />
                </td>
                <td className="title">
                  <strong>
                    <Link to={`/posts/${a.id}`}>{headlineOf(a)}</Link>
                    {a.status !== 'published' && filter === 'all' && <span className="muted"> — {a.status[0].toUpperCase() + a.status.slice(1)}</span>}
                  </strong>
                  <div className="row-actions">
                    {a.status === 'trash' ? (
                      <>
                        <button className="button-link" onClick={() => setStatus.mutate({ ids: [a.id], status: 'draft' })}>
                          Restore
                        </button>
                        <button className="button-link danger" onClick={() => confirm('Delete permanently?') && destroy.mutate([a.id])}>
                          Delete Permanently
                        </button>
                      </>
                    ) : (
                      <>
                        <Link to={`/posts/${a.id}`}>Edit</Link>
                        {a.status !== 'published' ? (
                          <button className="button-link" onClick={() => setStatus.mutate({ ids: [a.id], status: 'published' })}>
                            Publish
                          </button>
                        ) : (
                          <button className="button-link" onClick={() => setStatus.mutate({ ids: [a.id], status: 'draft' })}>
                            Unpublish
                          </button>
                        )}
                        <button className="button-link danger" onClick={() => setStatus.mutate({ ids: [a.id], status: 'trash' })}>
                          Trash
                        </button>
                        {a.sourceUrl && (
                          <a href={a.sourceUrl} target="_blank" rel="noreferrer">
                            Source ↗
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </td>
                <td className="hide-mobile">
                  {a.translations.map((t) => (
                    <span key={t.language} className="badge lang">
                      {t.language}
                    </span>
                  ))}
                </td>
                <td>{a.category?.names.en ?? '—'}</td>
                <td className="muted hide-mobile">{a.tags.join(', ') || '—'}</td>
                <td className="hide-mobile">{a.sourceName}</td>
                <td className="hide-mobile">
                  <span className={`dot ${seoScore(a)}`} title={`SEO: ${seoScore(a)}`} />
                </td>
                <td>
                  {a.status === 'published' ? 'Published' : a.status === 'draft' ? 'Last Modified' : a.status[0].toUpperCase() + a.status.slice(1)}
                  <br />
                  <span className="muted">{formatDate(a.status === 'draft' ? a.updatedAt : a.publishedAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.data && (
        <div className="tablenav">
          <span />
          <Pagination page={page} limit={LIMIT} total={list.data.total} onPage={(p) => setParam({ page: String(p) })} />
        </div>
      )}
    </>
  )
}
