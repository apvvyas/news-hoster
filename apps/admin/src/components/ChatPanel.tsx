import type { ChatMessage, Language, VersionContent } from '@news-hoster/sdk'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../api'
import { errorMessage, formatDate, langName } from '../lib/format'
import { Notice, Postbox, Spinner } from './ui'

const FIELD_LABELS: Record<keyof VersionContent, string> = {
  headline: 'Headline',
  summary: 'Summary',
  keyPoints: 'Key points',
  body: 'Body',
  seoTitle: 'SEO title',
  metaDescription: 'Meta description',
  focusKeyword: 'Focus keyphrase',
}

const QUICK = {
  en: ['Make the headline shorter', 'Make the tone more formal', 'Improve the SEO title and meta description', 'Write a 3-paragraph body from the source'],
  hi: ['शीर्षक छोटा करें', 'भाषा को और औपचारिक बनाएं', 'SEO शीर्षक और मेटा विवरण सुधारें', 'स्रोत से 3 पैराग्राफ का विवरण लिखें'],
} satisfies Record<Language, string[]>

function show(v: VersionContent[keyof VersionContent]) {
  return Array.isArray(v) ? v.map((p) => `• ${p}`).join('\n') : v || '(empty)'
}

function Proposal({ msg, current, onApply, applying }: { msg: ChatMessage; current: VersionContent; onApply: () => void; applying: boolean }) {
  const p = msg.proposal!
  if (msg.appliedRevisionId) {
    return (
      <div className="proposal">
        <span className="badge good">Applied ✓</span>
        <details>
          <summary>View applied version</summary>
          <dl>
            {(Object.keys(FIELD_LABELS) as (keyof VersionContent)[]).map((k) => (
              <div key={k}>
                <dt>{FIELD_LABELS[k]}</dt>
                <dd style={{ whiteSpace: 'pre-wrap' }}>{show(p[k])}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    )
  }
  const changed = (Object.keys(FIELD_LABELS) as (keyof VersionContent)[]).filter((k) => JSON.stringify(p[k]) !== JSON.stringify(current[k]))
  return (
    <div className="proposal">
      {changed.length === 0 ? (
        <p className="muted">No differences from the current version.</p>
      ) : (
        <dl>
          {changed.map((k) => (
            <div key={k}>
              <dt>{FIELD_LABELS[k]}</dt>
              <dd className="diff-new" style={{ whiteSpace: 'pre-wrap' }}>
                {show(p[k])}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <button className="button button-primary" onClick={onApply} disabled={applying || changed.length === 0}>
        {applying ? 'Applying…' : 'Apply suggestion'}
      </button>
    </div>
  )
}

interface Props {
  articleId: string
  language: Language
  /** The saved version on the server (proposals are compared with it). */
  current: VersionContent
  /** Unsaved local edits would be overwritten by applying a proposal. */
  dirty: boolean
  onApplied: () => void
}

/** Per-version chat with the Sarvam editorial assistant. */
export function ChatPanel({ articleId, language, current, dirty, onApplied }: Props) {
  const qc = useQueryClient()
  const key = ['chat', articleId, language]
  const chat = useQuery({ queryKey: key, queryFn: () => api.articles.chat(articleId, language) })
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const send = useMutation({
    mutationFn: (message: string) => api.articles.sendChat(articleId, language, message),
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: key })
    },
  })
  const apply = useMutation({
    mutationFn: (messageId: string) => api.articles.applyChat(articleId, messageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      onApplied()
    },
  })

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [chat.data?.messages.length, send.isPending])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (text.trim()) send.mutate(text.trim())
  }

  return (
    <Postbox title={`Editorial assistant — ${langName(language)}`}>
      {chat.data && !chat.data.available && (
        <Notice type="warning">
          The assistant needs <code>SARVAM_API_KEY</code> on the API server.
        </Notice>
      )}
      <div className="chat">
        <div className="messages" ref={listRef} aria-live="polite">
          {chat.isLoading && <Spinner />}
          {chat.data?.messages.length === 0 && (
            <p className="muted">
              Ask Sarvam to edit this {langName(language)} version, for example to shorten the headline, change the tone or improve SEO. Each suggestion can be
              applied with one click and is saved as a revision.
            </p>
          )}
          {chat.data?.messages.map((m) => (
            <div key={m.id} className={`msg ${m.role}`}>
              {m.content}
              {m.proposal && (
                <Proposal
                  msg={m}
                  current={current}
                  applying={apply.isPending && apply.variables === m.id}
                  onApply={() => {
                    if (!dirty || confirm('You have unsaved changes in this version. Applying the suggestion will replace them. Continue?')) apply.mutate(m.id)
                  }}
                />
              )}
              <div className="meta">
                {m.role === 'user' ? (m.author?.name ?? 'You') : 'Sarvam'} · {formatDate(m.createdAt)}
              </div>
            </div>
          ))}
          {send.isPending && (
            <div className="msg assistant">
              <Spinner /> Thinking…
            </div>
          )}
        </div>
        {(send.error || apply.error) && <Notice type="error">{errorMessage(send.error ?? apply.error)}</Notice>}
        <div className="suggestions">
          {QUICK[language].map((s) => (
            <button key={s} type="button" onClick={() => setText(s)}>
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={submit}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Suggest an edit for the ${langName(language)} version…`}
            aria-label="Message to the editorial assistant"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
            }}
          />
          <button className="button button-primary" disabled={send.isPending || !text.trim() || chat.data?.available === false}>
            Send
          </button>
        </form>
      </div>
    </Postbox>
  )
}
