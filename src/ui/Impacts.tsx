import { useId, useState } from 'react'
import { impactsFor, type Impact } from '../engine/impacts'
import { useProfile, type Product } from '../state/profile'
import { Chevron } from './primitives'
import type { Assumption } from '../engine/assumptions'
import { inr, inrFull } from '../engine/format'
import type { PlanView, Standing } from '../engine/standing'

const chipKind = (i: Impact, which: 'cover' | 'premium') => {
  if (i.win) return 'imp__c--win'
  if (which === 'cover') return i.coverMoved ? 'imp__c--moved' : ''
  return Math.abs(i.premiumDelta) >= 100 ? 'imp__c--moved' : ''
}

function Item({ i }: { i: Impact }) {
  const [open, setOpen] = useState(false)
  const uid = useId()
  return (
    <li className="imp" data-moved={i.moved} data-win={i.win}>
      <p className="imp__t">{i.win && <span className="tag tag--ok" style={{ marginRight: 8 }}>Already done</span>}{i.label}</p>
      <div className="imp__chips">
        <span className={`imp__c ${chipKind(i, 'cover')}`}>{i.coverLine}</span>
        <span className={`imp__c ${chipKind(i, 'premium')}`}>{i.premiumLine}</span>
        {i.addons.map((a) => <span key={a} className="imp__c imp__c--moved">Add-on: {a}</span>)}
      </div>
      <p className="imp__why">{i.why}</p>
      {i.todo.length > 0 && (
        <>
          <button type="button" className="imp__b" aria-expanded={open} aria-controls={uid} onClick={() => setOpen((o) => !o)}>
            What to do <Chevron />
          </button>
          {open && <ul className="imp__todo" id={uid}>{i.todo.map((t, k) => <li key={k}>{t}</li>)}</ul>}
        </>
      )}
    </li>
  )
}

/** Every answer the user has set, what it did to the cover and premium, and, if nothing moved, why not and what to do. */
export function ImpactPanel({ product }: { product: Product }) {
  const { p } = useProfile()
  const all = impactsFor(product, p)
  const moved = all.filter((i) => i.moved)
  const still = all.filter((i) => !i.moved)
  if (all.length === 0) return null
  return (
    <div className="stack stack--sm" aria-label="What your answers changed">
      <p className="eyebrow">What your answers changed</p>
      {moved.length > 0 && <ul className="imps">{moved.map((i) => <Item key={i.id} i={i} />)}</ul>}
      {still.length > 0 && (
        <>
          <p className="caption" style={{ marginTop: 4 }}>These answers do not change the cover itself. Here is why, and what to do instead.</p>
          <ul className="imps">{still.map((i) => <Item key={i.id} i={i} />)}</ul>
        </>
      )}
    </div>
  )
}

/** One-line live feedback shown right under a question, so a toggle never feels dead. */
export function Ripple({ product, ids }: { product: Product; ids: string[] }) {
  const { p } = useProfile()
  const rows = impactsFor(product, p).filter((i) => ids.includes(i.id))
  if (rows.length === 0) return null
  return (
    <ul className="ripple" aria-live="polite">
      {rows.map((i) => (
        <li key={i.id}><span className="ripple__l">{i.label}</span> {i.coverLine}. {i.premiumLine}.{i.addons.length > 0 && ` Add: ${i.addons.join(', ')}.`}</li>
      ))}
    </ul>
  )
}

/** Hero shown when the user already holds what we would recommend. Rewards what they have done, then lists only what is left. */
export function StandingHero({ s, compact }: { s: Standing; compact?: boolean }) {
  return (
    <div className="sorted">
      <div className="stack stack--sm">
        <h2 className="h1 sorted__h">{s.headline}</h2>
        <p className="body">{s.sub}</p>
      </div>
      {!compact && <KeepList items={s.keep} />}
    </div>
  )
}

/* ───────────────────────── Quick-flow pieces ───────────────────────── */
const ROLE: Record<string, { label: string; cls: string }> = {
  core: { label: 'Start here', cls: 'tag--ok' },
  suggested: { label: 'Suggested for you', cls: '' },
  extra: { label: 'Optional', cls: 'tag--muted' },
  have: { label: 'You have this', cls: 'tag--ok' },
}

const rng = (r: { low: number; high: number }) => (r.low === r.high ? inrFull(r.low) : `${inrFull(r.low)} to ${inrFull(r.high)}`)

/** Every plan to buy, each with its own cover and price, grouped by who it covers. Parents are never folded into the family line. */
export function PlanCards({ plans }: { plans: PlanView[] }) {
  if (plans.length === 0) return null
  const groups: { id: 'family' | 'parents'; title: string }[] = [{ id: 'family', title: 'For you and your family' }, { id: 'parents', title: 'For your parents, on their own plans' }]
  let n = 0
  return (
    <div className="stack">
      {groups.map((g) => {
        const list = plans.filter((x) => x.group === g.id)
        if (list.length === 0) return null
        return (
          <div className="stack stack--sm" key={g.id}>
            <p className="eyebrow">{g.title}</p>
            <ul className="plans">
              {list.map((pl) => {
                n += 1
                const role = ROLE[pl.role]
                return (
                  <li className="plan" data-role={pl.role} key={pl.id}>
                    <span className="plan__n" aria-hidden="true">{n}</span>
                    <div className="plan__b">
                      <div className="plan__h"><span className="plan__t">{pl.title}</span><span className={`tag ${role.cls}`}>{role.label}</span></div>
                      <p className="plan__c">{pl.cover > 0 ? <>{inr(pl.cover)}{pl.per && <span className="plan__u"> {pl.per}</span>}</> : <span className="plan__u">Add-on to the base plan</span>}</p>
                      {pl.role !== 'have' && pl.premium.high > 0 && <p className="plan__p">{rng(pl.premium)} a year{pl.premiumFor && <> {pl.premiumFor}</>} <span className="tag tag--muted">Indicative</span></p>}
                      <p className="plan__why">{pl.why}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

/** What the answer was built on, as a short summary. The filled-in guesses are marked, and one button edits them. */
export function AssumptionSummary({ items, onEdit }: { items: Assumption[]; onEdit: () => void }) {
  return (
    <>
      <p className="eyebrow">What we assumed</p>
      <dl className="assume__dl">
        {items.map((a) => (
          <div key={a.key}>
            <dt>{a.key}</dt>
            <dd>{a.value}{a.suggested && <i className="dot" role="img" aria-label="Suggested by us" />}</dd>
          </div>
        ))}
      </dl>
      {items.some((i) => i.suggested) && <p className="caption legend"><i className="dot" aria-hidden="true" /> We filled these in. Edit to use your own.</p>}
      <button type="button" className="btn btn--small" onClick={onEdit}>Edit details</button>
    </>
  )
}

/** The plans to buy, one line each. The full cards live in the details. */
export function PlanLines({ plans }: { plans: PlanView[] }) {
  if (plans.length === 0) return null
  return (
    <ul className="plines">
      {plans.map((pl) => (
        <li key={pl.id}>
          <span className="plines__t">{pl.short}</span>
          <span className="plines__c">{pl.cover > 0 ? <>{inr(pl.cover)}{pl.per && <span className="plan__u"> {pl.per}</span>}</> : <span className="plan__u">add-on</span>}</span>
          <span className="plines__p">{pl.role === 'have' ? 'You have this' : pl.premium.high > 0 ? `${rng(pl.premium)} a year` : ''}</span>
        </li>
      ))}
    </ul>
  )
}

/** What is left to do once the main cover is in place. */
export function KeepList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="stack stack--sm">
      <p className="eyebrow">What is left, to keep it that way</p>
      <ul className="keep">{items.map((k, i) => <li key={i}>{k}</li>)}</ul>
    </div>
  )
}

/** Shown in place of the add-ons and insurers steps when we are not suggesting anything to buy. */
export function NothingToBuy({ product, onBack, onElse }: { product: string; onBack: () => void; onElse: () => void }) {
  return (
    <div className="sum__main" style={{ maxWidth: 560 }}>
      <div className="stack">
        <p className="eyebrow result__eyebrow">Nothing to buy</p>
        <h2 className="h1">We are not suggesting any {product} insurance right now.</h2>
        <p className="body small">There is nothing to add or compare here. If your answers change, this updates.</p>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <button type="button" className="btn btn--brand" onClick={onBack}>Review my answers</button>
        <button type="button" className="btn" onClick={onElse}>Check something else</button>
      </div>
    </div>
  )
}
