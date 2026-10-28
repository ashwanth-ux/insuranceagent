import { ciCover, termRiderCost } from './addons'
import { healthAddonRows, termAddonRows } from './bundles'
import { inr, inrFull, roundTo } from './format'
import { computeHealth } from './health'
import { computeMotor, MOTOR_MODEL } from './motor'
import { motorStanding } from './standing'
import { computeTerm } from './term'
import type { Range, Verdict } from './types'
import { effectiveSpend, healthInputOf, monthlyEmi, motorInputOf, termInputOf } from '../state/derive'
import type { Product, Profile } from '../state/profile'

/**
 * Add-ons the user can switch on or off. What we suggest starts switched on. The cover and premium shown beside them
 * are recomputed from whatever is switched on, so the outcome is always what they chose.
 */
export interface AddonItem {
  id: string
  /** One short line for the list. The full reason is behind "Why". */
  blurb: string
  product: Product
  label: string
  verdict: Verdict
  reason: string
  watch?: string
  /** Yearly premium we can stand behind, or null when only the insurer can price it. */
  cost: Range | null
  /** Shown when there is no number: who prices it, or why there is no extra charge. */
  costNote?: string
  /** Extra cover this brings. */
  cover?: { amount: number; label: string }
  /** False for things we advise against buying at all (savings plans sold as life cover). */
  selectable: boolean
  on: boolean
}

export interface Outcome {
  /** One line per cover that results, e.g. "Family: ₹30 lakh". */
  lines: { label: string; value: string }[]
  /** Yearly premium of the base, and of what is switched on. */
  base: Range
  extras: Range
  total: Range
  /** Switched-on items we cannot put a number on. The insurer prices them. */
  unpriced: string[]
  /** What is switched on, by name. */
  picked: string[]
}

const ZERO: Range = { low: 0, mid: 0, high: 0 }
export const addRange = (...r: Range[]): Range => ({ low: r.reduce((s, x) => s + x.low, 0), mid: r.reduce((s, x) => s + x.mid, 0), high: r.reduce((s, x) => s + x.high, 0) })
const share = (r: Range, lo: number, hi: number): Range => ({ low: roundTo(r.low * lo, 100), mid: roundTo(r.mid * ((lo + hi) / 2), 100), high: roundTo(r.high * hi, 100) })

export const addonKey = (product: Product, id: string) => `${product}.${id}`
const isOn = (p: Profile, product: Product, id: string, verdict: Verdict, selectable: boolean) => selectable && (p.addons[addonKey(product, id)] ?? verdict === 'take')

/* ───────────────────────── Items ───────────────────────── */
export function addonItems(product: Product, p: Profile): AddonItem[] {
  if (product === 'term') {
    const t = computeTerm(termInputOf(p))
    const rows = termAddonRows(p)
    const ci = ciCover(effectiveSpend(p), monthlyEmi(p))
    const base = t.premium
    const live = t.recommended > 0
    return rows.map((r) => {
      let cost: Range | null = null
      let costNote: string | undefined
      let cover: AddonItem['cover']
      let selectable = true
      if (r.id === 'wop') cost = live ? termRiderCost(p.age, true, false) : ZERO
      else if (r.id === 'ci') { cost = live ? termRiderCost(p.age, false, true) : ZERO; cover = { amount: ci.rounded, label: 'Critical illness cover' } }
      else if (r.id === 'adb') cost = live ? share(base, 0.03, 0.1) : ZERO
      else if (r.id === 'raise') cost = live ? share(base, 0.02, 0.05) : ZERO
      else if (r.id === 'rop') cost = live ? share(base, 1, 2) : ZERO
      else if (r.id === 'payout') costNote = 'The insurer prices the payout option'
      else if (r.id === 'savings') { selectable = false; costNote = 'Not term cover. We do not recommend it' }
      return { id: r.id, blurb: blurbOf(r.id, r.reason, cover), product, label: r.label, verdict: r.verdict, reason: r.reason, watch: r.watch, cost, costNote, cover, selectable, on: isOn(p, product, r.id, r.verdict, selectable) }
    })
  }
  if (product === 'health') {
    const h = computeHealth(healthInputOf(p))
    return healthAddonRows(p).map((r) => {
      let cost: Range | null = null
      let costNote: string | undefined
      let cover: AddonItem['cover']
      if (r.id === 'stu') { cost = h.topUp.premium; cover = { amount: h.topUp.size, label: 'Super top-up' } }
      else if (r.id === 'maternity') cost = h.maternityOption.premium
      else if (r.id === 'room' || r.id === 'restore') costNote = 'A feature to look for in the plan, not a separate charge'
      else costNote = 'The insurer prices this'
      return { id: r.id, blurb: blurbOf(r.id, r.reason, cover), product, label: r.label, verdict: r.verdict, reason: r.reason, watch: r.watch, cost, costNote, cover, selectable: true, on: isOn(p, product, r.id, r.verdict, true) }
    })
  }
  const m = computeMotor(motorInputOf(p))
  return m.addons.map((a) => ({
    id: a.id, blurb: firstLine(a.reason), product, label: a.label, verdict: a.verdict, reason: a.reason, watch: a.note,
    // Motor premiums carry 18% GST that an individual cannot claim back, so every figure shown includes it.
    cost: a.price ? { low: roundTo(a.price.low * (1 + MOTOR_MODEL.gst), 50), mid: roundTo(a.price.mid * (1 + MOTOR_MODEL.gst), 50), high: roundTo(a.price.high * (1 + MOTOR_MODEL.gst), 50) } : null, costNote: a.price ? undefined : a.priceNote ?? 'The insurer prices this', selectable: m.recommended === 'comprehensive' || a.id === 'passenger',
    on: isOn(p, product, a.id, a.verdict, m.recommended === 'comprehensive' || a.id === 'passenger'),
  }))
}

/* ───────────────────────── Outcome ───────────────────────── */
export function outcomeFor(product: Product, p: Profile): Outcome {
  const items = addonItems(product, p).filter((i) => i.on)
  const priced = items.filter((i) => i.cost)
  const unpriced = items.filter((i) => !i.cost && !(i.id === 'room' || i.id === 'restore')).map((i) => i.label)
  const picked = items.map((i) => i.label)
  if (product === 'term') {
    const t = computeTerm(termInputOf(p))
    const extras = addRange(ZERO, ...priced.map((i) => i.cost!))
    const ci = items.find((i) => i.id === 'ci')
    return {
      lines: [{ label: 'Life cover', value: t.recommended > 0 ? inr(t.recommended) : 'Nothing to add' }, ...(ci?.cover && t.recommended > 0 ? [{ label: 'Critical illness cover', value: inr(ci.cover.amount) }] : [])],
      base: t.premium, extras, total: addRange(t.premium, extras), unpriced, picked,
    }
  }
  if (product === 'health') {
    const h = computeHealth(healthInputOf(p))
    const stu = items.find((i) => i.id === 'stu')
    const extras = addRange(ZERO, ...priced.map((i) => i.cost!))
    const held = p.covered.includes('ownHealth') && p.ownCover >= 3_00_000 ? p.ownCover : h.base
    const lines: Outcome['lines'] = [{ label: h.basePlans.parents || stu ? 'You and your family' : 'Your cover', value: inr(held + (stu?.cover?.amount ?? 0)) }]
    if (h.basePlans.parents) lines.push({ label: h.basePlans.parents.count === 1 ? 'Your parent' : 'Each parent', value: inr(h.basePlans.parents.each) })
    return { lines, base: h.basePlans.buyPremium, extras, total: addRange(h.basePlans.buyPremium, extras), unpriced, picked }
  }
  const m = computeMotor(motorInputOf(p))
  // Already holding the right policy: nothing to buy, so nothing to price.
  if (motorStanding(p).kind === 'sorted') return { lines: [{ label: 'Insured value', value: inr(m.idv) }, { label: 'Your policy', value: p.motorPolicy === 'comprehensive' ? 'Comprehensive' : 'Third-party only' }], base: ZERO, extras: ZERO, total: ZERO, unpriced: [], picked: [] }
  const base = m.recommended === 'comprehensive' ? m.premium.comprehensive : { low: m.premium.thirdPartyOnly.mid, mid: m.premium.thirdPartyOnly.mid, high: m.premium.thirdPartyOnly.mid }
  const extras: Range = m.recommended === 'comprehensive' ? addRange(ZERO, ...priced.map((i) => i.cost!)) : ZERO
  return {
    lines: [{ label: 'Insured value', value: inr(m.idv) }, { label: 'Cover', value: m.recommended === 'comprehensive' ? 'Comprehensive' : 'Third-party only' }],
    base, extras, total: addRange(base, extras), unpriced, picked,
  }
}

export const rangeText = (r: Range) => (r.low === r.high ? inrFull(r.low) : `${inrFull(r.low)} to ${inrFull(r.high)}`)

const one = (n: number) => {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2).replace(/\.?0+$/, '')}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return `₹${Math.round(n)}`
}
/** A short range for a list: "₹3.8K–5.8K". */
export const shortRange = (r: Range): string => {
  if (r.high <= 0) return 'Free'
  const a = one(r.low), b = one(r.high)
  if (a === b) return a
  const unit = (x: string) => x.slice(-1)
  return unit(a) === unit(b) && /[KL]$/.test(a) ? `${a.slice(0, -1)}–${b}` : `${a}–${b}`
}

/** The first sentence, kept short enough for one or two lines on a phone. */
export const firstLine = (t: string, max = 96): string => {
  const s = t.split(/(?<=[.!?])\s/)[0]
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`
}

const blurbOf = (id: string, reason: string, cover?: { amount: number; label: string }): string =>
  id === 'stu' && cover ? `Adds ${inr(cover.amount)} on top of your base plan.` : id === 'ci' && cover ? `Pays ${inr(cover.amount)} on diagnosis.` : firstLine(reason)

/**
 * True when we are not suggesting anything to buy for this product: no term cover needed, a clean base plan already held with no
 * super top-up or parents' plans to arrange, or the right vehicle policy already in place. There is then no add-on or insurer step.
 */
export const nothingToBuy = (product: Product, p: Profile): boolean => outcomeFor(product, p).total.high === 0
