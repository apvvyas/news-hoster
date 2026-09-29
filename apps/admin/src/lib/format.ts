import { LANGUAGE_NAMES, type Article, type Language } from '@news-hoster/sdk'

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

export const langName = (l: string) => LANGUAGE_NAMES[l as Language] ?? l

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** The English headline, or the first available language's. */
export function headlineOf(a: Article): string {
  return (a.translations.find((t) => t.language === 'en') ?? a.translations[0])?.headline ?? '(no title)'
}
