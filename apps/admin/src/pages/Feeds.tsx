import { LANGUAGES, type Feed, type FeedInput } from '@news-hoster/sdk'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { Field, Modal, Notice, PageHeader, Spinner } from '../components/ui'
import { errorMessage, langName, timeAgo } from '../lib/format'

const BLANK: FeedInput = { name: '', url: '', language: 'auto', defaultCategoryId: null, active: true, fetchIntervalMinutes: 30 }

export function FeedsPage() {
  const qc = useQueryClient()
  const feeds = useQuery({ queryKey: ['feeds'], queryFn: api.feeds.list })
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories.list })
  const [editing, setEditing] = useState<{ id?: string; form: FeedInput } | null>(null)
  const [notice, setNotice] = useState('')
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['feeds'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const save = useMutation({
    mutationFn: ({ id, form }: { id?: string; form: FeedInput }) => (id ? api.feeds.update(id, form) : api.feeds.create(form)),
    onSuccess: (f) => {
      setEditing(null)
      setNotice(`Feed “${f.name}” saved.`)
      refresh()
    },
  })
  const remove = useMutation({ mutationFn: api.feeds.remove, onSuccess: () => (setNotice('Feed deleted.'), refresh()) })
  const toggle = useMutation({ mutationFn: (f: Feed) => api.feeds.update(f.id, { active: !f.active }), onSuccess: refresh })
  const fetchNow = useMutation({
    mutationFn: api.feeds.fetchNow,
    onSuccess: (run) => {
      const r = run.fetch[0]
      setNotice(
        r
          ? r.status === 'error'
            ? `Fetch failed: ${r.error}`
            : r.status === 'not-modified'
              ? `${r.feedName}: not modified since last fetch.`
              : `${r.feedName}: ${r.new} new, ${r.duplicate} duplicate stories.`
          : (run.skipped ?? 'Done.'),
      )
      refresh()
    },
  })

  const edit = (f: Feed) =>
    setEditing({
      id: f.id,
      form: {
        name: f.name,
        url: f.url,
        language: f.language,
        defaultCategoryId: f.defaultCategory?.id ?? null,
        active: f.active,
        fetchIntervalMinutes: f.fetchIntervalMinutes,
      },
    })

  return (
    <>
      <PageHeader title="Feeds">
        <button className="page-title-action" onClick={() => setEditing({ form: { ...BLANK } })}>
          Add New Feed
        </button>
      </PageHeader>
      {notice && (
        <Notice type="success" onDismiss={() => setNotice('')}>
          {notice}
        </Notice>
      )}
      {(remove.error || toggle.error || fetchNow.error) && <Notice type="error">{errorMessage(remove.error ?? toggle.error ?? fetchNow.error)}</Notice>}
      <div className="table-wrap">
        <table className="wp-list-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Language</th>
              <th>Category hint</th>
              <th>Stories</th>
              <th>Every</th>
              <th>Last fetched</th>
            </tr>
          </thead>
          <tbody>
            {feeds.isLoading && (
              <tr>
                <td colSpan={6} className="empty">
                  <Spinner />
                </td>
              </tr>
            )}
            {feeds.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  No feeds yet. Add an RSS or Atom feed URL to start collecting news.
                </td>
              </tr>
            )}
            {feeds.data?.map((f) => (
              <tr key={f.id}>
                <td className="title">
                  <strong>
                    <a href="#" onClick={(e) => (e.preventDefault(), edit(f))}>
                      {f.name}
                    </a>
                    {!f.active && <span className="muted"> — Paused</span>}
                  </strong>
                  <div className="muted" style={{ wordBreak: 'break-all' }}>
                    {f.url}
                  </div>
                  {f.lastError && <div className="danger">⚠ {f.lastError}</div>}
                  <div className="row-actions">
                    <button className="button-link" onClick={() => edit(f)}>
                      Edit
                    </button>
                    <button className="button-link" disabled={fetchNow.isPending} onClick={() => fetchNow.mutate(f.id)}>
                      Fetch now
                    </button>
                    <button className="button-link" onClick={() => toggle.mutate(f)}>
                      {f.active ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      className="button-link danger"
                      onClick={() => confirm(`Delete “${f.name}” and all its collected stories? Published articles stay.`) && remove.mutate(f.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
                <td>{f.language === 'auto' ? 'Auto-detect' : langName(f.language)}</td>
                <td>{f.defaultCategory?.names.en ?? '—'}</td>
                <td className="muted">
                  {f.itemCounts?.done ?? 0} done · {f.itemCounts?.pending ?? 0} pending
                  {f.itemCounts?.failed ? ` · ${f.itemCounts.failed} failed` : ''}
                </td>
                <td>{f.fetchIntervalMinutes} min</td>
                <td className="muted">{timeAgo(f.lastFetchedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal
          title={editing.id ? 'Edit Feed' : 'Add New Feed'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="button button-primary" disabled={save.isPending} onClick={() => save.mutate(editing)}>
                {save.isPending ? 'Saving…' : 'Save Feed'}
              </button>
            </>
          }
        >
          {save.error && <Notice type="error">{errorMessage(save.error)}</Notice>}
          <Field label="Name">
            <input
              type="text"
              value={editing.form.name}
              onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })}
              autoFocus
            />
          </Field>
          <Field label="Feed URL" hint="RSS or Atom URL, e.g. https://example.com/rss.xml">
            <input type="url" value={editing.form.url} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, url: e.target.value } })} />
          </Field>
          <Field label="Language" hint="Auto-detect tells Hindi (Devanagari) and English apart per story.">
            <select
              value={editing.form.language}
              onChange={(e) => setEditing({ ...editing, form: { ...editing.form, language: e.target.value as FeedInput['language'] } })}
            >
              <option value="auto">Auto-detect</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {langName(l)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category hint" hint="Stories are usually filed here; Sarvam may re-classify.">
            <select
              value={editing.form.defaultCategoryId ?? ''}
              onChange={(e) => setEditing({ ...editing, form: { ...editing.form, defaultCategoryId: e.target.value || null } })}
            >
              <option value="">(none)</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.names.en}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fetch every (minutes)">
            <input
              type="number"
              min={5}
              max={1440}
              value={editing.form.fetchIntervalMinutes}
              onChange={(e) => setEditing({ ...editing, form: { ...editing.form, fetchIntervalMinutes: Number(e.target.value) } })}
            />
          </Field>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={editing.form.active}
              onChange={(e) => setEditing({ ...editing, form: { ...editing.form, active: e.target.checked } })}
            />{' '}
            Active
          </label>
        </Modal>
      )}
    </>
  )
}
