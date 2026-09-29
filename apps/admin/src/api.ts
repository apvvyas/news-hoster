import { createAdminClient } from '@news-hoster/sdk'

const TOKEN_KEY = 'nh_admin_token'

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* private mode: stay signed in for this tab only */
    }
  },
}

// Demo builds (VITE_DEMO=1) answer every API call in the browser; the module is
// only bundled into those builds.
const demoFetch: typeof fetch | undefined = __DEMO__ ? (input, init) => import('./demo/mock-api').then((m) => m.demoFetch(input, init)) : undefined

export const api = createAdminClient({
  baseUrl: __DEMO__ ? '' : (import.meta.env.VITE_API_URL ?? ''),
  fetch: demoFetch,
  getToken: () => tokenStore.get(),
  onUnauthorized: () => {
    if (tokenStore.get()) {
      tokenStore.set(null)
      window.dispatchEvent(new Event('nh:signed-out'))
    }
  },
})
