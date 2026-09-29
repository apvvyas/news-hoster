import { LANGUAGES, type Language, type RestructureEngine, type Settings } from '@news-hoster/sdk'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth-context'
import { Notice, PageHeader, Spinner } from '../components/ui'
import { errorMessage, langName } from '../lib/format'

type Form = { autoPublish: boolean; engine: RestructureEngine; targetLanguages: Language[]; batchSize: number }

export function SettingsPage() {
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings.get })
  if (!settings.data) return settings.error ? <Notice type="error">{errorMessage(settings.error)}</Notice> : <Spinner />
  return <SettingsForm s={settings.data} />
}

function SettingsForm({ s }: { s: Settings }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [form, setForm] = useState<Form>(() => ({ autoPublish: s.autoPublish, engine: s.engine, targetLanguages: s.targetLanguages, batchSize: s.batchSize }))
  const [saved, setSaved] = useState(false)
  const readOnly = user?.role !== 'admin'

  const save = useMutation({
    mutationFn: () => api.settings.update(form),
    onSuccess: (s) => {
      qc.setQueryData(['settings'], s)
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setSaved(true)
    },
  })

  return (
    <>
      <PageHeader title="Settings" />
      {saved && (
        <Notice type="success" onDismiss={() => setSaved(false)}>
          Settings saved.
        </Notice>
      )}
      {save.error && <Notice type="error">{errorMessage(save.error)}</Notice>}
      {readOnly && <Notice type="info">Only administrators can change settings.</Notice>}
      <table className="form-table">
        <tbody>
          <tr>
            <th>Rewriting engine</th>
            <td>
              <select value={form.engine} disabled={readOnly} onChange={(e) => setForm({ ...form, engine: e.target.value as RestructureEngine })}>
                <option value="auto">Automatic (Sarvam when configured)</option>
                <option value="sarvam">Sarvam AI</option>
                <option value="extractive">Extractive clean-up only (no AI)</option>
              </select>
              <p className="description">
                Sarvam ({s.sarvamModel}) is {s.sarvamConfigured ? <strong>configured</strong> : <strong className="danger">not configured</strong>} on the
                server (<code>SARVAM_API_KEY</code>). Currently in use: <strong>{s.effectiveEngine}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <th>Languages</th>
            <td>
              {LANGUAGES.map((l) => (
                <label key={l} className="checkbox">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={form.targetLanguages.includes(l)}
                    onChange={(e) =>
                      setForm({ ...form, targetLanguages: e.target.checked ? [...form.targetLanguages, l] : form.targetLanguages.filter((x) => x !== l) })
                    }
                  />
                  {langName(l)}
                </label>
              ))}
              <p className="description">Every new article is written in each selected language, whatever the source language.</p>
            </td>
          </tr>
          <tr>
            <th>Publishing</th>
            <td>
              <label className="checkbox">
                <input type="checkbox" disabled={readOnly} checked={form.autoPublish} onChange={(e) => setForm({ ...form, autoPublish: e.target.checked })} />
                Publish new articles immediately
              </label>
              <p className="description">When off, new articles wait as drafts until an editor publishes them.</p>
            </td>
          </tr>
          <tr>
            <th>Batch size</th>
            <td>
              <input
                type="number"
                min={1}
                max={200}
                disabled={readOnly}
                value={form.batchSize}
                onChange={(e) => setForm({ ...form, batchSize: Number(e.target.value) })}
              />
              <p className="description">Stories rewritten per pipeline run.</p>
            </td>
          </tr>
        </tbody>
      </table>
      {!readOnly && (
        <p>
          <button className="button button-primary" disabled={save.isPending || form.targetLanguages.length === 0} onClick={() => save.mutate()}>
            Save Changes
          </button>
        </p>
      )}
    </>
  )
}
