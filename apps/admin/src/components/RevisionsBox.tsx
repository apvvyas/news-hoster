import type { Language } from '@news-hoster/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { errorMessage, formatDate, langName } from '../lib/format'
import { Modal, Notice, Postbox } from './ui'

export function RevisionsBox({ articleId, language, onRestored }: { articleId: string; language: Language; onRestored: () => void }) {
  const revs = useQuery({ queryKey: ['revisions', articleId, language], queryFn: () => api.articles.revisions(articleId, language) })
  const [viewing, setViewing] = useState<string | null>(null)
  const restore = useMutation({
    mutationFn: (revId: string) => api.articles.restoreRevision(articleId, revId),
    onSuccess: () => {
      setViewing(null)
      revs.refetch()
      onRestored()
    },
  })
  const rev = revs.data?.find((r) => r.id === viewing)

  return (
    <Postbox title={`Revisions — ${langName(language)} (${revs.data?.length ?? 0})`}>
      {restore.error && <Notice type="error">{errorMessage(restore.error)}</Notice>}
      <ul className="revisions">
        {revs.data?.map((r, i) => (
          <li key={r.id}>
            <div>
              <div>
                {r.note} {i === 0 && <span className="badge good">current</span>}
              </div>
              <div className="who">
                {r.author?.name ?? 'Pipeline'} · {formatDate(r.createdAt)}
              </div>
            </div>
            <button className="button-link" onClick={() => setViewing(r.id)}>
              View
            </button>
          </li>
        ))}
        {revs.data?.length === 0 && <li className="muted">No revisions yet.</li>}
      </ul>
      {rev && (
        <Modal
          title={`Revision · ${formatDate(rev.createdAt)}`}
          onClose={() => setViewing(null)}
          footer={
            <>
              <button className="button" onClick={() => setViewing(null)}>
                Close
              </button>
              <button className="button button-primary" disabled={restore.isPending} onClick={() => restore.mutate(rev.id)}>
                Restore This Revision
              </button>
            </>
          }
        >
          <p className="muted">
            {rev.note} by {rev.author?.name ?? 'Pipeline'}
          </p>
          <h2>{rev.content.headline}</h2>
          <p>{rev.content.summary}</p>
          {rev.content.keyPoints.length > 0 && (
            <ul>
              {rev.content.keyPoints.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {rev.content.body && <p style={{ whiteSpace: 'pre-wrap' }}>{rev.content.body}</p>}
          <p className="muted">
            SEO title: {rev.content.seoTitle || '—'}
            <br />
            Meta description: {rev.content.metaDescription || '—'}
            <br />
            Focus keyphrase: {rev.content.focusKeyword || '—'}
          </p>
        </Modal>
      )}
    </Postbox>
  )
}
