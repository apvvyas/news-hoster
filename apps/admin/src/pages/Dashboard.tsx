import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api } from '../api'
import { Notice, PageHeader, Postbox, Spinner } from '../components/ui'
import { errorMessage, formatDate, langName, timeAgo } from '../lib/format'

export function DashboardPage() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard, refetchInterval: 30_000 })
  const run = useMutation({
    mutationFn: () => api.pipeline.run(),
    onSuccess: () => qc.invalidateQueries(),
  })

  if (isLoading) return <Spinner />
  if (error || !data) return <Notice type="error">{errorMessage(error)}</Notice>
  const a = data.articles
  const i = data.items
  const last = run.data ?? data.pipeline.lastRun

  return (
    <>
      <PageHeader title="Dashboard" />
      {!data.settings.sarvamConfigured && (
        <Notice type="warning">
          <p>
            <strong>Sarvam is not configured.</strong> Stories are only cleaned up, not rewritten or translated. Set <code>SARVAM_API_KEY</code> on the API
            server to enable AI restructuring and the editorial assistant.
          </p>
        </Notice>
      )}
      {data.feeds.failing.length > 0 && (
        <Notice type="error">
          <p>
            {data.feeds.failing.length} feed(s) are failing: {data.feeds.failing.map((f) => f.name).join(', ')}. <Link to="/feeds">Check feeds</Link>
          </p>
        </Notice>
      )}
      <div className="dashboard-grid">
        <Postbox title="At a Glance">
          <div className="glance">
            <Link to="/posts?status=publish">✔ {a.published ?? 0} Published</Link>
            <Link to="/posts?status=draft">✎ {a.draft ?? 0} Drafts awaiting review</Link>
            <Link to="/queue?status=pending">⇣ {i.pending ?? 0} Stories in queue</Link>
            <Link to="/queue?status=failed">⚠ {i.failed ?? 0} Failed stories</Link>
            <Link to="/feeds">
              ◉ {data.feeds.active} of {data.feeds.total} feeds active
            </Link>
            <span>▦ {data.sites} websites</span>
          </div>
          <p className="muted mt">
            Rewriting with <strong>{data.settings.effectiveEngine === 'sarvam' ? `Sarvam (${data.settings.sarvamModel})` : 'extractive clean-up'}</strong> into{' '}
            {data.settings.targetLanguages.map(langName).join(' + ')}. New articles are{' '}
            {data.settings.autoPublish ? 'published automatically' : 'saved as drafts for review'}.
          </p>
        </Postbox>

        <Postbox
          title="Pipeline"
          actions={
            <button className="button button-primary" disabled={run.isPending || data.pipeline.running} onClick={() => run.mutate()}>
              {run.isPending ? 'Running…' : 'Run now'}
            </button>
          }
        >
          {run.error && <Notice type="error">{errorMessage(run.error)}</Notice>}
          {!last ? (
            <p className="muted">No run yet since the server started. Feeds are fetched on a schedule.</p>
          ) : (
            <>
              <p>
                Last run {timeAgo(last.finishedAt)} ({formatDate(last.finishedAt)}){last.skipped && <> — skipped: {last.skipped}</>}
              </p>
              {last.fetch.length > 0 && (
                <ul>
                  {last.fetch.map((f) => (
                    <li key={f.feedId}>
                      <strong>{f.feedName}</strong>:{' '}
                      {f.status === 'error' ? (
                        <span className="danger">{f.error}</span>
                      ) : f.status === 'not-modified' ? (
                        'not modified'
                      ) : (
                        `${f.new} new, ${f.duplicate} duplicate`
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {last.restructure && (
                <p>
                  Restructured <strong>{last.restructure.done}</strong>, failed {last.restructure.failed} ({last.restructure.engine})
                  {last.restructure.stoppedEarly && <span className="danger"> — stopped: {last.restructure.stoppedEarly}</span>}
                </p>
              )}
            </>
          )}
        </Postbox>

        <Postbox title="Quick links">
          <ul>
            <li>
              <Link to="/posts?status=draft">Review drafts</Link>
            </li>
            <li>
              <Link to="/feeds">Add an RSS feed</Link>
            </li>
            <li>
              <Link to="/sites">Connect a website</Link>
            </li>
            <li>
              <a href={`${import.meta.env.VITE_API_URL ?? ''}/api/docs`} target="_blank" rel="noreferrer">
                API documentation ↗
              </a>
            </li>
          </ul>
        </Postbox>
      </div>
    </>
  )
}
