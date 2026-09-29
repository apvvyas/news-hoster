import { LANGUAGES, type Language, type Site, type SiteInput, type SiteWithKey } from '@news-hoster/sdk'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { useConfirm } from '../confirm-context'
import { Field, Modal, Notice, PageHeader, Spinner } from '../components/ui'
import { errorMessage, langName } from '../lib/format'

const BLANK: SiteInput = { name: '', slug: '', domain: '', description: '', defaultLanguage: 'en', languages: ['en'], categoryIds: [], active: true }

function KeyBox({ result, onClose }: { result: SiteWithKey; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <Modal
      title={`API key for ${result.site.name}`}
      onClose={onClose}
      footer={
        <button className="button button-primary" onClick={onClose}>
          I have saved the key
        </button>
      }
    >
      <div className="keybox">
        <strong>Copy this key now — it will not be shown again.</strong>
        <code id="api-key-value">{result.apiKey}</code>
        <button
          className="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(result.apiKey)
              setCopied(true)
            } catch {
              // Clipboard blocked: select the key so it can be copied by hand.
              const code = document.getElementById('api-key-value')
              if (code) window.getSelection()?.selectAllChildren(code)
            }
          }}
        >
          {copied ? 'Copied ✓' : 'Copy to clipboard'}
        </button>
      </div>
      <p>In the website's React app:</p>
      <pre style={{ background: '#f6f7f7', padding: 8, overflowX: 'auto', fontSize: 12 }}>{`import { createNewsClient } from '@news-hoster/sdk'

const news = createNewsClient({
  baseUrl: 'https://your-api-domain',
  apiKey: import.meta.env.VITE_SITE_KEY,
})
const { items } = await news.articles({ limit: 10 })`}</pre>
    </Modal>
  )
}

export function SitesPage() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const sites = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories.list })
  const [editing, setEditing] = useState<{ id?: string; form: SiteInput } | null>(null)
  const [key, setKey] = useState<SiteWithKey | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['sites'] })

  const save = useMutation({
    mutationFn: async ({ id, form }: { id?: string; form: SiteInput }) => {
      const body = { ...form, domain: form.domain || null }
      if (id) return { site: await api.sites.update(id, body), apiKey: null }
      return api.sites.create(body)
    },
    onSuccess: (res) => {
      setEditing(null)
      if (res.apiKey) setKey(res as SiteWithKey)
      refresh()
    },
  })
  const rotate = useMutation({ mutationFn: api.sites.rotateKey, onSuccess: (r) => (setKey(r), refresh()) })
  const remove = useMutation({ mutationFn: api.sites.remove, onSuccess: refresh })

  const edit = (s: Site) =>
    setEditing({
      id: s.id,
      form: {
        name: s.name,
        slug: s.slug,
        domain: s.domain ?? '',
        description: s.description,
        defaultLanguage: s.defaultLanguage,
        languages: s.languages,
        categoryIds: s.categories.map((c) => c.id),
        active: s.active,
      },
    })
  const f = editing?.form
  const setF = (patch: Partial<SiteInput>) => editing && setEditing({ ...editing, form: { ...editing.form, ...patch } })

  return (
    <>
      <PageHeader title="Sites">
        <button className="page-title-action" onClick={() => setEditing({ form: { ...BLANK } })}>
          Add New Site
        </button>
      </PageHeader>
      <p className="description">Each public website gets its own API key and chooses which languages and categories it shows.</p>
      {(rotate.error || remove.error) && <Notice type="error">{errorMessage(rotate.error ?? remove.error)}</Notice>}
      <div className="table-wrap">
        <table className="wp-list-table">
          <thead>
            <tr>
              <th>Site</th>
              <th>Languages</th>
              <th>Categories</th>
              <th>API key</th>
            </tr>
          </thead>
          <tbody>
            {sites.isLoading && (
              <tr>
                <td colSpan={4} className="empty">
                  <Spinner />
                </td>
              </tr>
            )}
            {sites.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">
                  No sites yet. Add one for each of your websites.
                </td>
              </tr>
            )}
            {sites.data?.map((s) => (
              <tr key={s.id}>
                <td className="title">
                  <strong>
                    <a href="#" onClick={(e) => (e.preventDefault(), edit(s))}>
                      {s.name}
                    </a>
                    {!s.active && <span className="muted"> — Disabled</span>}
                  </strong>
                  <div className="muted">{s.domain ?? s.slug}</div>
                  <div className="row-actions">
                    <button className="button-link" onClick={() => edit(s)}>
                      Edit
                    </button>
                    <button
                      className="button-link"
                      onClick={async () =>
                        (await confirm({
                          title: 'Generate a new API key?',
                          message: 'The current key stops working immediately. Update the website with the new key.',
                          confirmLabel: 'Generate new key',
                        })) && rotate.mutate(s.id)
                      }
                    >
                      New API key
                    </button>
                    <button
                      className="button-link danger"
                      onClick={async () =>
                        (await confirm({
                          title: `Delete “${s.name}”?`,
                          message: 'Its API key stops working and the website can no longer load news.',
                          confirmLabel: 'Delete site',
                          danger: true,
                        })) && remove.mutate(s.id)
                      }
                    >
                      Delete
                    </button>
                  </div>
                </td>
                <td>
                  {s.languages.map((l) => (
                    <span key={l} className="badge lang" title={l === s.defaultLanguage ? 'Default' : undefined}>
                      {l}
                      {l === s.defaultLanguage && ' ★'}
                    </span>
                  ))}
                </td>
                <td className="muted">{s.categories.length ? s.categories.map((c) => c.names.en).join(', ') : 'All'}</td>
                <td>
                  <code>{s.apiKeyPrefix}…</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && f && (
        <Modal
          title={editing.id ? 'Edit Site' : 'Add New Site'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="button button-primary" disabled={save.isPending} onClick={() => save.mutate(editing)}>
                {editing.id ? 'Save Site' : 'Create Site & Key'}
              </button>
            </>
          }
        >
          {save.error && <Notice type="error">{errorMessage(save.error)}</Notice>}
          <Field label="Name">
            <input
              type="text"
              value={f.name}
              onChange={(e) =>
                setF({
                  name: e.target.value,
                  ...(!editing.id && {
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, ''),
                  }),
                })
              }
              autoFocus
            />
          </Field>
          <Field label="Slug">
            <input type="text" value={f.slug} onChange={(e) => setF({ slug: e.target.value })} />
          </Field>
          <Field label="Domain" hint="Optional, for your reference.">
            <input type="text" value={f.domain ?? ''} onChange={(e) => setF({ domain: e.target.value })} placeholder="news.example.com" />
          </Field>
          <Field label="Description">
            <textarea rows={2} value={f.description} onChange={(e) => setF({ description: e.target.value })} />
          </Field>
          <div className="field">
            Languages
            {LANGUAGES.map((l) => (
              <label key={l} className="checkbox">
                <input
                  type="checkbox"
                  checked={f.languages.includes(l)}
                  onChange={(e) => {
                    const languages = e.target.checked ? [...f.languages, l] : f.languages.filter((x) => x !== l)
                    setF({ languages, defaultLanguage: languages.includes(f.defaultLanguage) ? f.defaultLanguage : (languages[0] as Language) })
                  }}
                />
                {langName(l)}
              </label>
            ))}
          </div>
          <Field label="Default language">
            <select value={f.defaultLanguage} onChange={(e) => setF({ defaultLanguage: e.target.value as Language })}>
              {f.languages.map((l) => (
                <option key={l} value={l}>
                  {langName(l)}
                </option>
              ))}
            </select>
          </Field>
          <div className="field">
            Categories <span className="hint">None selected = all categories.</span>
            <div className="category-checklist">
              {categories.data?.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={f.categoryIds?.includes(c.id) ?? false}
                    onChange={(e) =>
                      setF({ categoryIds: e.target.checked ? [...(f.categoryIds ?? []), c.id] : (f.categoryIds ?? []).filter((x) => x !== c.id) })
                    }
                  />
                  {c.names.en}
                </label>
              ))}
            </div>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ active: e.target.checked })} /> Active (key works)
          </label>
        </Modal>
      )}
      {key && <KeyBox result={key} onClose={() => setKey(null)} />}
    </>
  )
}
