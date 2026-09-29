import type { Role, User, UserInput } from '@news-hoster/sdk'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth-context'
import { Field, Modal, Notice, PageHeader, Spinner } from '../components/ui'
import { errorMessage, formatDate } from '../lib/format'

const BLANK: UserInput = { email: '', name: '', password: '', role: 'editor' }

export function UsersPage() {
  const qc = useQueryClient()
  const { user: me } = useAuth()
  const users = useQuery({ queryKey: ['users'], queryFn: api.users.list })
  const [editing, setEditing] = useState<{ user?: User; form: UserInput & { active: boolean } } | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] })

  const save = useMutation({
    mutationFn: ({ user, form }: NonNullable<typeof editing>) => {
      if (!user) return api.users.create(form)
      const { password, ...rest } = form
      return api.users.update(user.id, password ? form : rest)
    },
    onSuccess: () => (setEditing(null), refresh()),
  })
  const remove = useMutation({ mutationFn: api.users.remove, onSuccess: refresh })

  return (
    <>
      <PageHeader title="Users">
        <button className="page-title-action" onClick={() => setEditing({ form: { ...BLANK, active: true } })}>
          Add New User
        </button>
      </PageHeader>
      <p className="description">
        <strong>Administrators</strong> manage everything. <strong>Editors</strong> manage posts, feeds and categories, but not sites, users or settings.
      </p>
      {remove.error && <Notice type="error">{errorMessage(remove.error)}</Notice>}
      <div className="table-wrap">
        <table className="wp-list-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Last login</th>
            </tr>
          </thead>
          <tbody>
            {users.isLoading && (
              <tr>
                <td colSpan={4} className="empty">
                  <Spinner />
                </td>
              </tr>
            )}
            {users.data?.map((u) => (
              <tr key={u.id}>
                <td className="title">
                  <strong>
                    {u.name}
                    {!u.active && <span className="muted"> — Deactivated</span>}
                  </strong>
                  <div className="row-actions">
                    <button
                      className="button-link"
                      onClick={() => setEditing({ user: u, form: { email: u.email, name: u.name, password: '', role: u.role, active: u.active } })}
                    >
                      Edit
                    </button>
                    {u.id !== me?.id && (
                      <button className="button-link danger" onClick={() => confirm(`Delete ${u.name}?`) && remove.mutate(u.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </td>
                <td>{u.email}</td>
                <td>{u.role === 'admin' ? 'Administrator' : 'Editor'}</td>
                <td className="muted">{formatDate(u.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal
          title={editing.user ? `Edit ${editing.user.name}` : 'Add New User'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="button button-primary" disabled={save.isPending} onClick={() => save.mutate(editing)}>
                {editing.user ? 'Update User' : 'Add New User'}
              </button>
            </>
          }
        >
          {save.error && <Notice type="error">{errorMessage(save.error)}</Notice>}
          <Field label="Name">
            <input type="text" value={editing.form.name} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })} />
          </Field>
          <Field label="Email">
            <input type="email" value={editing.form.email} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, email: e.target.value } })} />
          </Field>
          <Field
            label={editing.user ? 'New password' : 'Password'}
            hint={editing.user ? 'Leave empty to keep the current password.' : 'At least 8 characters.'}
          >
            <input
              type="password"
              autoComplete="new-password"
              value={editing.form.password}
              onChange={(e) => setEditing({ ...editing, form: { ...editing.form, password: e.target.value } })}
            />
          </Field>
          <Field label="Role">
            <select
              value={editing.form.role}
              onChange={(e) => setEditing({ ...editing, form: { ...editing.form, role: e.target.value as Role } })}
              disabled={editing.user?.id === me?.id}
            >
              <option value="editor">Editor</option>
              <option value="admin">Administrator</option>
            </select>
          </Field>
          {editing.user && editing.user.id !== me?.id && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={editing.form.active}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, active: e.target.checked } })}
              />{' '}
              Active (can log in)
            </label>
          )}
        </Modal>
      )}
    </>
  )
}
