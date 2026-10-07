import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { inr, parseMoney, group, clamp } from '../engine/format'
import type { Flag } from '../engine/types'

/* ───────────────────────── Icons ───────────────────────── */
export const Chevron = ({ className = 'disc__chev' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 5l4.5 4.5L11.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
export const Arrow = () => (
  <svg className="arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
export const Tick = () => (
  <svg className="chip__tick" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

/* ───────────────────────── Chips ───────────────────────── */
export interface Opt<T extends string> {
  id: T
  label: string
}

export function Chip({ on, onClick, children, soft, multi = false }: { on: boolean; onClick: () => void; children: ReactNode; soft?: boolean; multi?: boolean }) {
  return (
    <button type="button" className={`chip${soft ? ' chip--soft' : ''}`} aria-pressed={on} role={multi ? 'checkbox' : undefined} aria-checked={multi ? on : undefined} onClick={onClick}>
      {!soft && <Tick />}
      {children}
    </button>
  )
}

/** Single choice. */
export function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: readonly Opt<T>[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className="chip" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          <Tick />
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Multi choice with an exclusive "none" chip: empty means none. */
export function Multi<T extends string>({ value, options, onChange, none, label }: { value: readonly T[]; options: readonly Opt<T>[]; onChange: (v: T[]) => void; none?: string; label: string }) {
  const toggle = (id: T) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <Chip key={o.id} multi on={value.includes(o.id)} onClick={() => toggle(o.id)}>{o.label}</Chip>
      ))}
      {none && <Chip multi on={value.length === 0} onClick={() => onChange([])}>{none}</Chip>}
    </div>
  )
}

export function Seg<T extends string>({ value, options, onChange, label, block }: { value: T; options: readonly Opt<T>[]; onChange: (v: T) => void; label: string; block?: boolean }) {
  return (
    <div className={`seg${block ? ' seg--block' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} aria-pressed={value === o.id} className="seg__opt" onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  )
}

export function Toggle({ value, onChange, yes = 'Yes', no = 'No', label }: { value: boolean; onChange: (v: boolean) => void; yes?: string; no?: string; label: string }) {
  return <Seg<'y' | 'n'> label={label} value={value ? 'y' : 'n'} onChange={(v) => onChange(v === 'y')} options={[{ id: 'y', label: yes }, { id: 'n', label: no }]} />
}

/* ───────────────────────── Question wrapper ───────────────────────── */
export function Question({ n, title, hint, children }: { n?: number; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="q" aria-label={n ? `Question ${n}` : title}>
      <div className="q__head">
        {n !== undefined && <span className="q__n" aria-hidden="true">{n}</span>}
        <div>
          <h3 className="q__t">{title}</h3>
          {hint && <p className="q__hint">{hint}</p>}
        </div>
      </div>
      <div className="q__body">{children}</div>
    </section>
  )
}

/* ───────────────────────── Stepper ───────────────────────── */
export function Stepper({ value, min, max, onChange, unit, label, step = 1 }: { value: number; min: number; max: number; onChange: (n: number) => void; unit?: string; label: string; step?: number }) {
  const [text, setText] = useState(String(value))
  const [editing, setEditing] = useState(false)
  useEffect(() => { if (!editing) setText(String(value)) }, [value, editing])
  const commit = (raw: string) => {
    const n = Number(raw.replace(/[^\d.]/g, ''))
    const v = Number.isFinite(n) && raw.trim() !== '' ? clamp(Math.round(n), min, max) : value
    onChange(v)
    setText(String(v))
    setEditing(false)
  }
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="stepper__b" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(clamp(value - step, min, max))}>−</button>
      <input className="stepper__v" inputMode="numeric" aria-label={label} value={text} onFocus={(e) => { setEditing(true); e.currentTarget.select() }} onChange={(e) => setText(e.target.value.replace(/[^\d]/g, '').slice(0, 3))} onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      {unit && <span className="stepper__u">{unit}</span>}
      <button type="button" className="stepper__b" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(clamp(value + step, min, max))}>+</button>
    </div>
  )
}

/* ───────────────────────── Money field with slider ───────────────────────── */
type Curve = 'log' | 'cubic' | 'linear'

function curveFor(min: number, max: number): Curve {
  if (max / Math.max(min, 1) <= 12 && min > 0) return 'linear'
  return min > 0 ? 'log' : 'cubic'
}
const toPos = (v: number, min: number, max: number, c: Curve) => {
  const x = clamp(v, min, max)
  if (c === 'linear') return (x - min) / (max - min)
  if (c === 'log') return Math.log(x / min) / Math.log(max / min)
  return Math.cbrt((x - min) / (max - min))
}
const fromPos = (t: number, min: number, max: number, c: Curve) => {
  if (c === 'linear') return min + t * (max - min)
  if (c === 'log') return min * Math.pow(max / min, t)
  return min + Math.pow(t, 3) * (max - min)
}
/** Round to a human-friendly value at the current magnitude: ₹2,48,317 → ₹2.5 lakh. */
const nice = (v: number, min: number, step: number) => {
  if (v <= min) return min
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))) - 1)
  const s = Math.max(step, mag * (v >= 1e5 ? 5 : 1))
  return Math.max(min, Math.round(v / s) * s)
}

export interface MoneyProps {
  label: string
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  step: number
  /** Why the range is what it is, shown when we have to move a typed number. */
  why: string
  hint?: ReactNode
  presets?: { label: string; value: number }[]
  noSlider?: boolean
  /** Shown beside the label when the value is our estimate rather than the user's own. */
  estimated?: boolean
  hideLabel?: boolean
}

export function Money({ label, value, onChange, min, max, step, why, hint, presets, noSlider, estimated, hideLabel }: MoneyProps) {
  const id = useId()
  const [text, setText] = useState(group(value))
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const curve = useMemo(() => curveFor(min, max), [min, max])

  useEffect(() => { if (!editing) setText(group(value)) }, [value, editing])
  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), 5000)
    return () => clearTimeout(t)
  }, [note])

  const commit = (raw: string) => {
    setEditing(false)
    const parsed = raw.trim() === '' ? null : parseMoney(raw) ?? (Number(raw.replace(/,/g, '')) || null)
    if (parsed === null || !Number.isFinite(parsed)) {
      setText(group(value))
      setNote(raw.trim() === '' ? null : `That does not look like an amount. We kept ${inr(value)}.`)
      return
    }
    const v = clamp(parsed, min, max)
    if (v !== parsed) setNote(`${parsed < min ? 'Lowest' : 'Highest'} we can work with here is ${inr(v)}. ${why}`)
    onChange(v)
    setText(group(v))
  }

  const pos = toPos(value, min, max, curve)
  const tipLeft = `calc(${pos * 100}% + ${(0.5 - pos) * 24}px)`

  return (
    <div className="stack--sm stack" style={{ gap: 8 }}>
      <label className={hideLabel ? 'sr' : 'label'} htmlFor={id}>
        {label} {estimated && <span className="tag tag--muted" style={{ marginLeft: 6 }}>Estimate</span>}
      </label>
      <div className="money">
        <span className="money__sym" aria-hidden="true">₹</span>
        <input id={id} className="input input--money" inputMode="decimal" autoComplete="off" value={text} aria-invalid={!!note && note.startsWith('That')} aria-describedby={`${id}-h`}
          onFocus={(e) => { const el = e.currentTarget; setEditing(true); setText(String(Math.round(value))); requestAnimationFrame(() => el.select()) }}
          onChange={(e) => setText(e.target.value.replace(/[^\d.,a-zA-Z\s]/g, '').slice(0, 18))}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      </div>
      {!noSlider && (
        <div>
          <div className="slider">
            <span className="slider__tip" style={{ left: tipLeft }} aria-hidden="true">{inr(value)}</span>
            <input className="slider__in" type="range" min={0} max={1000} step={1} value={Math.round(pos * 1000)} aria-label={`${label} slider`} aria-valuetext={inr(value)}
              style={{ ['--fill' as string]: `${pos * 100}%` }}
              onChange={(e) => onChange(nice(fromPos(Number(e.target.value) / 1000, min, max, curve), min, step))} />
          </div>
          <div className="slider__ends"><span>{inr(min)}</span><span>{inr(max)}</span></div>
        </div>
      )}
      {presets && (
        <div className="chips">
          {presets.map((p) => <Chip soft key={p.label} on={Math.round(value) === p.value} onClick={() => onChange(clamp(p.value, min, max))}>{p.label}</Chip>)}
        </div>
      )}
      <p id={`${id}-h`} className={`hint ${note ? (note.startsWith('That') ? 'hint--err' : 'hint--note') : ''}`} role={note ? 'status' : undefined}>{note ?? hint}</p>
    </div>
  )
}

/* ───────────────────────── Disclosure ───────────────────────── */
export function Disclose({ title, children, defaultOpen = false, bare, id, open: controlled, onOpenChange }: { title: string; children: ReactNode; defaultOpen?: boolean; bare?: boolean; id?: string; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [inner, setInner] = useState(defaultOpen)
  const open = controlled ?? inner
  const setOpen = (f: (o: boolean) => boolean) => { const n = f(open); setInner(n); onOpenChange?.(n) }
  const uid = useId()
  return (
    <div className={`disc${bare ? ' disc--bare' : ''}`} data-open={open} id={id}>
      <button type="button" className="disc__b" aria-expanded={open} aria-controls={`${uid}-p`} onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <Chevron />
      </button>
      <div className="disc__panel" id={`${uid}-p`} role="region" aria-label={title}>
        <div className="disc__inner" {...(!open ? { inert: true } : {})}>
          <div className="disc__pad">{children}</div>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── Small pieces ───────────────────────── */
export function Flags({ items }: { items: Flag[] }) {
  if (!items.length) return null
  return (
    <div className="stack--sm stack" role="list">
      {items.map((f, i) => (
        <div className="flag" data-l={f.level} key={i} role="listitem">
          <span className="flag__i" aria-hidden="true" />
          <span>{f.text}</span>
        </div>
      ))}
    </div>
  )
}

export function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v], i) => (
        <div className="kv__r" key={i}>
          <dt className="kv__k">{k}</dt>
          <dd className="kv__v">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Low–base–high on one line. */
export function RangeBar({ low, mid, high, fmt = inr, label }: { low: number; mid: number; high: number; fmt?: (n: number) => string; label: string }) {
  const span = Math.max(high - low, 1)
  const p = (v: number) => `${clamp(((v - low) / span) * 100, 0, 100)}%`
  return (
    <figure role="img" aria-label={`${label}: low ${fmt(low)}, most likely ${fmt(mid)}, high ${fmt(high)}`}>
      <div className="bar">
        <div className="bar__fill" style={{ left: 0, right: 0 }} />
        <div className="bar__mark" style={{ left: p(mid) }} />
      </div>
      <div className="bar__ends"><span>{fmt(low)}</span><span>{fmt(high)}</span></div>
    </figure>
  )
}

export function Insight({ children }: { children: ReactNode }) {
  return <div className="card card--insight small" style={{ padding: 16 }}>{children}</div>
}

/** Animates between numbers so a changed answer feels responsive rather than jumpy. */
export function useTween(target: number, ms = 360): number {
  const [v, setV] = useState(target)
  const from = useRef(target)
  const raf = useRef(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(target); from.current = target; return }
    const start = performance.now()
    const a = from.current
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const e = 1 - Math.pow(1 - t, 3)
      const cur = a + (target - a) * e
      setV(cur)
      from.current = cur
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, ms])
  return v
}

export function StepBar({ items, current, onGo }: { items: string[]; current: number; onGo: (n: number) => void }) {
  return (
    <nav className="steps" aria-label="Steps">
      <p className="steps__m" aria-hidden="true">Step {current} of {items.length} <span>{items[current - 1]}</span></p>
      <div className="steps__row" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((t, i) => {
          const n = i + 1
          return (
            <button type="button" key={t} className="steps__i" data-n={n} data-state={n < current ? 'done' : n === current ? 'now' : 'next'} aria-current={n === current ? 'step' : undefined} aria-label={`Step ${n}: ${t}`} onClick={() => onGo(n)}>
              <span>{n}. {t}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
