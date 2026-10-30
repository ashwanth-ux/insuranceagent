import { emit } from './bridge'

/**
 * "Was this helpful?" feedback. One row per person per journey goes to a Google Sheet through a web app (see
 * scripts/feedback-sheet). Nothing the person told the guide about themselves is sent: only the rating, the few words they
 * chose to write, which journey they were on, the kind of device, and a random id that stops a retry from adding a second row.
 */
export const FEEDBACK_URL: string | undefined = import.meta.env.VITE_FEEDBACK_WEBHOOK_URL || undefined

export type Helpful = 'yes' | 'no'
/** The journey the person finished: one product on its own, or the full guide. */
export type Journey = 'term' | 'health' | 'full'

export interface Feedback {
  helpful: Helpful
  comment: string
  journey: Journey
  device: 'phone' | 'computer'
  sessionId: string
  /** Where the guide ran: its own page, or inside a host app. */
  surface: 'web' | 'app'
}

export const COMMENT_MAX = 500

/** Trim, collapse stray whitespace and cap the length, so nothing odd reaches the sheet. */
export function cleanComment(text: string): string {
  return text.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, COMMENT_MAX)
}

const ID_KEY = 'kyfr-insurance-agent.session'
const SENT_KEY = 'kyfr-insurance-agent.feedback'

const randomId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)

/** A random id for this browser, kept so a retry of the same feedback reuses it. Nothing about the person. */
export function sessionId(): string {
  try {
    const found = localStorage.getItem(ID_KEY)
    if (found) return found
    const id = randomId()
    localStorage.setItem(ID_KEY, id)
    return id
  } catch { return randomId() }
}

/** Remembers which journeys already got feedback in this browser, so the form thanks the person instead of asking twice. */
export const alreadySent = (journey: Journey): boolean => {
  try { return (JSON.parse(localStorage.getItem(SENT_KEY) || '[]') as string[]).includes(journey) } catch { return false }
}
const markSent = (journey: Journey) => {
  try { localStorage.setItem(SENT_KEY, JSON.stringify([...new Set([...(JSON.parse(localStorage.getItem(SENT_KEY) || '[]') as string[]), journey])])) } catch { /* optional */ }
}

export const deviceKind = (): Feedback['device'] => (typeof matchMedia !== 'undefined' && matchMedia('(max-width: 760px)').matches ? 'phone' : 'computer')
export const inHostApp = (): boolean => {
  const w = window as Window & { ReactNativeWebView?: unknown; webkit?: { messageHandlers?: { kyfr?: unknown } } }
  return !!(w.ReactNativeWebView || w.webkit?.messageHandlers?.kyfr || window.parent !== window)
}

type Fetch = typeof fetch
class HttpError extends Error {}

/**
 * Sends one piece of feedback. The host app (if any) is told as well, so it can follow it in its own analytics.
 * Resolves 'sent', or 'skipped' when no web app is configured (a local preview). Throws when the sheet could not be reached.
 */
export async function sendFeedback(fb: Feedback, url: string | undefined = FEEDBACK_URL, fetchImpl: Fetch = fetch, timeoutMs = 15000): Promise<'sent' | 'skipped'> {
  const body: Feedback = { ...fb, comment: cleanComment(fb.comment) }
  emit({ type: 'feedback', helpful: body.helpful, comment: body.comment, journey: body.journey })
  if (!url) { console.warn('VITE_FEEDBACK_WEBHOOK_URL is not set: feedback not saved'); return 'skipped' }
  const init = { method: 'POST', body: JSON.stringify(body), keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' } }
  const timer = new AbortController()
  const t = setTimeout(() => timer.abort(), timeoutMs)
  try {
    try {
      const res = await fetchImpl(url, { ...init, signal: timer.signal })
      if (!res.ok) throw new HttpError('HTTP ' + res.status)
      const reply = await res.json().catch(() => null)
      if (reply && reply.ok === false) throw new HttpError(reply.error || 'server')
    } catch (e) {
      if (e instanceof HttpError || (e as Error).name === 'AbortError') throw e
      // Some browsers block reading Google's redirected reply. The write still happens, and the sheet ignores a repeat
      // of the same session and journey, so a blind resend cannot add a second row.
      await fetchImpl(url, { ...init, mode: 'no-cors', signal: timer.signal })
    }
    markSent(body.journey)
    return 'sent'
  } finally { clearTimeout(t) }
}
