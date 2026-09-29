import { LANGUAGES, type Category, type CategoryInput } from '@news-hoster/sdk'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { Field, Notice, PageHeader, Postbox, Spinner } from '../components/ui'
import { errorMessage, langName } from '../lib/format'

const BLANK: CategoryInput = { slug: '', names: { en: '' }, sortOrder: 0 }

export function CategoriesPage() {
  const qc = useQueryClient()
  const list = useQuery({ queryKey: ['categories'], queryFn: api.categories.list })
  const [form, setForm] = useState<CategoryInput>(BLANK)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const save = useMutation({
    mutationFn: () => (editingId ? api.categories.update(editingId, form) : api.categories.create(form)),
    onSuccess: (c) => {
      setNotice(`Category “${c.names.en}” ${editingId ? 'updated' : 'added'}.`)
      setForm(BLANK)
      setEditingId(null)
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
  const remove = useMutation({
    mutationFn: api.categories.remove,
    onSuccess: () => {
      setNotice('Category deleted. Its articles are now uncategorised.')
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
  const startEdit = (c: Category) => {
    setEditingId(c.id)
    setForm({ slug: c.slug, names: { ...c.names }, sortOrder: c.sortOrder })
  }

  return (
    <>
      <PageHeader title="Categories" />
      {notice && (
        <Notice type="success" onDismiss={() => setNotice('')}>
          {notice}
        </Notice>
      )}
      {remove.error && <Notice type="error">{errorMessage(remove.error)}</Notice>}
      <div className="post-body" style={{ gridTemplateColumns: '340px minmax(0,1fr)' }}>
        <Postbox title={editingId ? 'Edit Category' : 'Add New Category'}>
          {save.error && <Notice type="error">{errorMessage(save.error)}</Notice>}
          {LANGUAGES.map((l) => (
            <Field key={l} label={`Name (${langName(l)})`} hint={l === 'en' ? 'Required.' : 'Shown on sites in this language.'}>
              <input
                type="text"
                lang={l}
                value={form.names[l] ?? ''}
                onChange={(e) => {
                  const names = { ...form.names, [l]: e.target.value }
                  if (!e.target.value && l !== 'en') delete names[l]
                  setForm({
                    ...form,
                    names,
                    slug:
                      !editingId && l === 'en'
                        ? e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, '')
                        : form.slug,
                  })
                }}
              />
            </Field>
          ))}
          <Field label="Slug" hint="The URL-friendly version of the name.">
            <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </Field>
          <Field label="Order">
            <input type="number" value={form.sortOrder ?? 0} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
          </Field>
          <div className="inline">
            <button className="button button-primary" disabled={save.isPending} onClick={() => save.mutate()}>
              {editingId ? 'Update Category' : 'Add New Category'}
            </button>
            {editingId && (
              <button className="button" onClick={() => (setEditingId(null), setForm(BLANK))}>
                Cancel
              </button>
            )}
          </div>
        </Postbox>
        <div className="table-wrap">
          <table className="wp-list-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>हिन्दी</th>
                <th>Slug</th>
                <th>Order</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading && (
                <tr>
                  <td colSpan={4} className="empty">
                    <Spinner />
                  </td>
                </tr>
              )}
              {list.data?.map((c) => (
                <tr key={c.id}>
                  <td className="title">
                    <strong>
                      <a href="#" onClick={(e) => (e.preventDefault(), startEdit(c))}>
                        {c.names.en}
                      </a>
                    </strong>
                    <div className="row-actions">
                      <button className="button-link" onClick={() => startEdit(c)}>
                        Edit
                      </button>
                      <button className="button-link danger" onClick={() => confirm(`Delete “${c.names.en}”?`) && remove.mutate(c.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                  <td lang="hi">{c.names.hi ?? '—'}</td>
                  <td>{c.slug}</td>
                  <td>{c.sortOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
