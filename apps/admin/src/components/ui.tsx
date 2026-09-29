import { useEffect, type ReactNode } from 'react'

export function Notice({
  type = 'info',
  children,
  onDismiss,
}: {
  type?: 'info' | 'success' | 'error' | 'warning'
  children: ReactNode
  onDismiss?: () => void
}) {
  return (
    <div className={`notice notice-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <div>{children}</div>
      {onDismiss && (
        <button className="dismiss" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  )
}

export function Spinner() {
  return <span className="spinner" aria-label="Loading" />
}

export function Postbox({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="postbox">
      <div className="postbox-header">
        <h2>{title}</h2>
        {actions}
      </div>
      <div className="inside">{children}</div>
    </div>
  )
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      {label}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

export function StatusLinks<T extends string>({
  items,
  current,
  onSelect,
}: {
  items: { key: T; label: string; count?: number }[]
  current: T
  onSelect: (key: T) => void
}) {
  return (
    <ul className="subsubsub">
      {items.map((i) => (
        <li key={i.key}>
          <a
            href="#"
            className={i.key === current ? 'current' : ''}
            onClick={(e) => {
              e.preventDefault()
              onSelect(i.key)
            }}
          >
            {i.label} {i.count !== undefined && <span className="count">({i.count})</span>}
          </a>
        </li>
      ))}
    </ul>
  )
}

export function Pagination({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit))
  return (
    <div className="pages">
      <span>{total} items</span>
      {pages > 1 && (
        <>
          <button className="button" disabled={page <= 1} onClick={() => onPage(1)} aria-label="First page">
            «
          </button>
          <button className="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
            ‹
          </button>
          <span>
            {page} of {pages}
          </span>
          <button className="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
            ›
          </button>
          <button className="button" disabled={page >= pages} onClick={() => onPage(pages)} aria-label="Last page">
            »
          </button>
        </>
      )}
    </div>
  )
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      {children}
    </div>
  )
}
