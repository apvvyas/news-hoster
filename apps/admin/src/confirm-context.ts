import { createContext, useContext } from 'react'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}

export type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

export const ConfirmContext = createContext<ConfirmFn | null>(null)

/** In-page replacement for window.confirm() (which embedded frames may block). */
export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext)
  if (!fn) throw new Error('useConfirm must be used inside ConfirmProvider')
  return fn
}
