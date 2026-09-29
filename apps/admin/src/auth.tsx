import type { User } from '@news-hoster/sdk'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, tokenStore } from './api'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(Boolean(tokenStore.get()))

  useEffect(() => {
    if (!tokenStore.get()) return
    api
      .me()
      .then(setUser)
      .catch(() => tokenStore.set(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const onSignedOut = () => setUser(null)
    window.addEventListener('nh:signed-out', onSignedOut)
    return () => window.removeEventListener('nh:signed-out', onSignedOut)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password)
    tokenStore.set(res.accessToken)
    setUser(res.user)
  }, [])

  const logout = useCallback(() => {
    tokenStore.set(null)
    setUser(null)
  }, [])

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}
