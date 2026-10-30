import { useRef, useState } from 'react'
import { alreadySent, cleanComment, COMMENT_MAX, deviceKind, inHostApp, sendFeedback, sessionId, type Helpful, type Journey } from '../feedback'
import { Choice } from './primitives'

type State = 'idle' | 'sending' | 'sent' | 'failed'

const PROMPT: Record<Helpful, { label: string; placeholder: string }> = {
  yes: { label: 'What was most useful?', placeholder: 'A few words are plenty' },
  no: { label: 'What was missing or unclear?', placeholder: 'A few words are plenty' },
}

/** "Was this helpful?": a rating, a few optional words, and a thank-you. Sent once per journey. */
export function Feedback({ journey }: { journey: Journey }) {
  const [helpful, setHelpful] = useState<Helpful | null>(null)
  const [comment, setComment] = useState('')
  const [state, setState] = useState<State>(alreadySent(journey) ? 'sent' : 'idle')
  // A ref, not state: three quick taps arrive before React re-renders, and all three must see "already sending".
  const busy = useRef(false)

  const send = async () => {
    if (!helpful || busy.current) return
    busy.current = true
    setState('sending')
    try {
      await sendFeedback({ helpful, comment: cleanComment(comment), journey, device: deviceKind(), sessionId: sessionId(), surface: inHostApp() ? 'app' : 'web' })
      setState('sent')
    } catch { setState('failed') } finally { busy.current = false }
  }

  if (state === 'sent') {
    return (
      <section className="card fb no-print" aria-label="Feedback" aria-live="polite">
        <p className="fb__t">Thank you. That helps us make this better.</p>
      </section>
    )
  }

  return (
    <section className="card fb no-print" aria-label="Feedback">
      <p className="fb__t">Was this helpful?</p>
      <Choice<Helpful> label="Was this helpful?" value={helpful ?? ('' as Helpful)} onChange={(v) => { setHelpful(v); if (state === 'failed') setState('idle') }} options={[{ id: 'yes', label: 'Yes, it helped' }, { id: 'no', label: 'Not really' }]} />
      {helpful && (
        <div className="fb__more">
          <label className="label" htmlFor="fb-comment">{PROMPT[helpful].label} <span className="fb__opt">Optional</span></label>
          <textarea id="fb-comment" className="fb__box" rows={3} maxLength={COMMENT_MAX} placeholder={PROMPT[helpful].placeholder} value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="fb__row">
            <button type="button" className="btn btn--brand" disabled={state === 'sending'} onClick={send}>{state === 'sending' ? 'Sending' : state === 'failed' ? 'Try again' : 'Send'}</button>
            <span className="caption fb__n" aria-hidden="true">{comment.length > COMMENT_MAX - 80 ? `${COMMENT_MAX - comment.length} left` : ''}</span>
          </div>
          {state === 'failed' && <p className="fb__err" role="alert">We could not send that. Check your connection and try again. Your words are still here.</p>}
          <p className="caption">Only your rating and what you write here are sent, with no name or contact details. The answers you gave the guide stay in your browser.</p>
        </div>
      )}
    </section>
  )
}
