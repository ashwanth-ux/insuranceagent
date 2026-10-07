import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * A sheet that slides over the page: a drawer from the right on wide screens, a full-height sheet from the bottom on phones.
 * The page behind stays where it was, so closing it puts the person back exactly where they were.
 */
export function Sheet({ open, onClose, title, live, doneLabel = 'Done', children }: { open: boolean; onClose: () => void; title: string; live?: ReactNode; doneLabel?: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    back.current = document.activeElement as HTMLElement | null
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus({ preventScroll: true })
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab' || !panel.current) return
      const f = [...panel.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled') && x.offsetParent !== null)
      if (f.length === 0) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      document.body.style.overflow = prev
      back.current?.focus?.({ preventScroll: true })
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="sheet" role="presentation">
      <button type="button" className="sheet__bg" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div className="sheet__panel" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panel}>
        <header className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          <button type="button" className="sheet__done" onClick={onClose}>{doneLabel}</button>
        </header>
        {live && <div className="sheet__live" aria-live="polite">{live}</div>}
        <div className="sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
