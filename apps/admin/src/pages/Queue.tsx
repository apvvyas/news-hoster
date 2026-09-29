import type { ItemStatus } from '@news-hoster/sdk'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { api } from '../api'
import { Notice, PageHeader, Pagination, Spinner, StatusLinks } from '../components/ui'
import { errorMessage, formatDate } from '../lib/format'

type Filter = 'all' | ItemStatus
const LIMIT = 25

export function QueuePage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const filter = (params.get('status') as Filter | null) ?? 'all'
  const page = Number(params.get('page') ?? 1)
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard })
  const list = useQuery({
    queryKey: ['items', filter, page],
    queryFn: () => api.items.list({ status: filter === 'all' ? undefined : filter, page, limit: LIMIT }),
    placeholderData: keepPreviousData,
  })
  const retry = useMutation({ mutationFn: api.items.retry, onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }) })
  const run = useMutation({ mutationFn: () => api.pipeline.run({ fetch: false }), onSuccess: () => qc.invalidateQueries() })
  const counts = dash.data?.items ?? {}
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)

  return (
    <>
      <PageHeader title="Ingest Queue">
        <button className="page-title-action" disabled={run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? 'Restructuring…' : 'Restructure pending now'}
        </button>
      </PageHeader>
      <p className="description">
        Every story collected from your feeds. Pending stories are rewritten by the pipeline; duplicates of an existing headline are skipped.
      </p>
      {run.data?.restructure && (
        <Notice type="success">
          Restructured {run.data.restructure.done}, failed {run.data.restructure.failed}
          {run.data.restructure.stoppedEarly && ` — stopped: ${run.data.restructure.stoppedEarly}`}
        </Notice>
      )}
      {(retry.error || run.error) && <Notice type="error">{errorMessage(retry.error ?? run.error)}</Notice>}
      <StatusLinks<Filter>
        current={filter}
        onSelect={(k) => setParams(k === 'all' ? {} : { status: k })}
        items={[
          { key: 'all', label: 'All', count: total },
          { key: 'pending', label: 'Pending', count: counts.pending ?? 0 },
          { key: 'done', label: 'Restructured', count: counts.done ?? 0 },
          { key: 'duplicate', label: 'Duplicates', count: counts.duplicate ?? 0 },
          { key: 'failed', label: 'Failed', count: counts.failed ?? 0 },
        ]}
      />
      <div className="table-wrap">
        <table className="wp-list-table">
          <thead>
            <tr>
              <th>Story</th>
              <th>Feed</th>
              <th>Lang</th>
              <th>Status</th>
              <th>Published</th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading && (
              <tr>
                <td colSpan={5} className="empty">
                  <Spinner />
                </td>
              </tr>
            )}
            {list.data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  Nothing here.
                </td>
              </tr>
            )}
            {list.data?.items.map((i) => (
              <tr key={i.id}>
                <td className="title" lang={i.language}>
                  <strong>
                    <a href={i.url} target="_blank" rel="noreferrer">
                      {i.title}
                    </a>
                  </strong>
                  <div className="muted">
                    {i.content.slice(0, 160)}
                    {i.content.length > 160 && '…'}
                  </div>
                  {i.error && (
                    <div className="danger">
                      Error ({i.attempts} attempts): {i.error}
                    </div>
                  )}
                  {(i.status === 'failed' || i.status === 'skipped' || (i.status === 'pending' && i.attempts > 0)) && (
                    <div className="row-actions" style={{ visibility: 'visible' }}>
                      <button className="button-link" onClick={() => retry.mutate(i.id)}>
                        Retry
                      </button>
                    </div>
                  )}
                </td>
                <td>{i.feed?.name}</td>
                <td>
                  <span className="badge lang">{i.language}</span>
                </td>
                <td>
                  <span className={`badge ${i.status}`}>{i.status}</span>
                </td>
                <td className="muted">{formatDate(i.publishedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.data && (
        <div className="tablenav">
          <span />
          <Pagination
            page={page}
            limit={LIMIT}
            total={list.data.total}
            onPage={(p) => setParams({ ...(filter !== 'all' && { status: filter }), page: String(p) })}
          />
        </div>
      )}
    </>
  )
}
