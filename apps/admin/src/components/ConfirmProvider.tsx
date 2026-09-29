import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ConfirmContext, type ConfirmOptions } from '../confirm-context'
import { Modal } from './ui'

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(ok: boolean) => void>(() => {})

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve
        setOpts(o)
      }),
    [],
  )
  const close = useCallback((ok: boolean) => {
    resolver.current(ok)
    setOpts(null)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <Modal
          title={opts.title}
          onClose={() => close(false)}
          footer={
            <>
              <button className="button" onClick={() => close(false)}>
                Cancel
              </button>
              <button className={`button button-primary ${opts.danger ? 'button-danger' : ''}`} onClick={() => close(true)} autoFocus>
                {opts.confirmLabel ?? 'OK'}
              </button>
            </>
          }
        >
          {opts.message && <p style={{ margin: 0 }}>{opts.message}</p>}
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}
