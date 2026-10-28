import { HEALTH_PLANS, MOTOR_INSURER_TERMS, TERM_PLANS } from '../data/plans'
import { inr } from './format'
import type { Funnel } from './funnel'
import { factsFor } from './insurerFacts'
import { insurerBySlug } from './kb'
import { computeMotor } from './motor'
import { addonItems, outcomeFor, rangeText, type Outcome } from './selection'
import { computeTerm } from './term'
import { planPremium } from './termplans'
import { motorInputOf, termInputOf } from '../state/derive'
import type { Product, Profile } from '../state/profile'

/** One insurer's card, as the insurers page and the saved report both show it. */
export interface Line { ok: boolean | null; text: string }
export interface Card { key: string; slug: string; title: string; plan?: string; cover: string; premium: string; withAddons?: string; lines: Line[]; note?: string }

export function buildCards(tab: Product, p: Profile, f: Funnel): { cards: Card[]; out: Outcome } {
  const out = outcomeFor(tab, p)
  const on = new Set(addonItems(tab, p).filter((i) => i.on).map((i) => i.id))
  const surv = new Set(f.survivors.map((s) => s.slug))
  const cards: Card[] = []
  const withAdd = out.extras.high > 0 ? rangeText(out.total) : undefined

  if (tab === 'term') {
    const t = computeTerm(termInputOf(p))
    const cover = t.recommended
    for (const pl of TERM_PLANS.filter((x) => surv.has(x.insurer))) {
      const price = planPremium(pl, { age: p.age, gender: p.gender, smoker: p.smoker, cover, coverToAge: t.coverToAge })
      const lines: Line[] = []
      if (on.has('wop')) lines.push({ ok: pl.wop.offered && pl.wop.trigger === 'ci+disability', text: !pl.wop.offered ? 'No waiver of premium' : pl.wop.trigger === 'ci+disability' ? 'Waiver on illness and disability' : pl.wop.trigger === 'terminal' ? 'Waiver on terminal illness only' : 'Waiver on disability' })
      if (on.has('ci')) lines.push({ ok: pl.ci.offered && pl.ci.type !== 'accelerated', text: !pl.ci.offered ? 'No critical illness cover' : `${pl.ci.type === 'accelerated' ? 'Accelerated' : 'Extra'} critical illness${pl.ci.illnesses ? `, ${pl.ci.illnesses} illnesses` : ''}` })
      if (on.has('raise')) lines.push({ ok: pl.lifeStage === true, text: pl.lifeStage ? 'Cover can rise at marriage or a child' : 'No life-stage increase stated' })
      if (on.has('adb')) lines.push({ ok: pl.accidentalDeath === true, text: pl.accidentalDeath ? 'Accident rider' : 'No accident rider stated' })
      if (on.has('rop')) lines.push({ ok: pl.rop === true, text: pl.rop ? 'Return-of-premium variant' : 'No return-of-premium variant stated' })
      lines.push({ ok: null, text: pl.premiumBreak ? 'Premium break: defer a year, repay later' : pl.highlights[0] })
      cards.push({ key: pl.id, slug: pl.insurer, title: insurerBySlug('life', pl.insurer)?.name ?? pl.insurer, plan: pl.name, cover: `Cover ${inr(cover)} to age ${t.coverToAge}`, premium: `${rangeText(price)} a year`, withAddons: withAdd, lines: lines.slice(0, 4) })
    }
  } else if (tab === 'health') {
    for (const pl of HEALTH_PLANS.filter((x) => surv.has(x.insurer))) {
      const lines: Line[] = []
      if (on.has('room')) lines.push({ ok: pl.roomRent === 'none', text: pl.roomRent === 'none' ? 'No room-rent limit' : 'Room-rent limit depends on variant' })
      if (on.has('restore')) lines.push({ ok: true, text: `Restoration: ${pl.restoration.toLowerCase()}` })
      if (on.has('ped')) lines.push({ ok: pl.pedReducible, text: `Existing-condition wait ${pl.pedWaitYears} years${pl.pedReducible ? ', can be cut' : ''}` })
      if (on.has('stu')) lines.push({ ok: null, text: 'Super top-up: ask for the same room-rent terms' })
      if (on.has('maternity')) lines.push({ ok: null, text: 'Check maternity limit and wait on the quote' })
      lines.push({ ok: null, text: `${pl.networkHospitals ? `${pl.networkHospitals.toLocaleString('en-IN')}+ network hospitals` : 'Network not stated'} · ${pl.pedWaitYears}-year wait for existing conditions` })
      cards.push({ key: pl.id, slug: pl.insurer, title: insurerBySlug('health', pl.insurer)?.name ?? pl.insurer, plan: pl.name, cover: out.lines.map((l) => `${l.label} ${l.value}`).join(' · '), premium: `${rangeText(out.base)} a year`, withAddons: withAdd, lines: lines.slice(0, 4), note: pl.variantNote })
    }
  } else {
    const m = computeMotor(motorInputOf(p))
    for (const c of f.survivors) {
      const t = MOTOR_INSURER_TERMS.find((x) => x.insurer === c.slug)
      const g = t?.garages ? Object.values(t.garages).filter((x): x is number => typeof x === 'number') : []
      const lines: Line[] = []
      if (g.length) lines.push({ ok: null, text: `${Math.max(...g).toLocaleString('en-IN')}+ cashless garages` })
      if (on.has('zeroDep') && t?.zeroDepMaxVehicleYears) lines.push({ ok: true, text: `Zero depreciation to ${t.zeroDepMaxVehicleYears} years, ${t.zeroDepClaimsPerYear === 'unlimited' ? 'unlimited claims' : `${t.zeroDepClaimsPerYear} claims a year`}` })
      if (on.has('rsa') && t?.roadsideAssist) lines.push({ ok: null, text: `Roadside help: ${t.roadsideAssist}` })
      if (t?.claimSpeed) lines.push({ ok: null, text: t.claimSpeed })
      cards.push({ key: c.slug, slug: c.slug, title: c.name, cover: `Insured value ${inr(m.idv)}`, premium: `${rangeText(out.total)} a year`, lines: lines.slice(0, 4) })
    }
  }

  // Every insurer that cleared the bar gets a card, even where we do not hold plan-level details for it yet.
  const t0 = tab === 'term' ? computeTerm(termInputOf(p)) : null
  for (const c of f.survivors) {
    if (cards.some((x) => x.slug === c.slug)) continue
    const facts = factsFor(tab, c.slug).slice(0, 3)
    cards.push({
      key: `${c.slug}-insurer`, slug: c.slug, title: c.name,
      cover: tab === 'term' && t0 ? `Cover ${inr(t0.recommended)} to age ${t0.coverToAge}` : out.lines.map((l) => `${l.label} ${l.value}`).join(' · '),
      premium: `${rangeText(tab === 'term' && t0 ? t0.premium : out.base)} a year`, withAddons: withAdd,
      lines: [...facts.map((x) => ({ ok: null, text: `${x.label}: ${x.value}` })), { ok: null, text: 'Plan-level details are not in our data yet. Use the checklist in add-ons.' }].slice(0, 4),
    })
  }
  return { cards, out }
}
