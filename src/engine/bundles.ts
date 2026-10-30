import { healthAddons, termAddons, type AddonRow } from './addons'
import { LAKH } from './format'
import { computeHealth } from './health'
import { computeTerm } from './term'
import type { Profile } from '../state/profile'
import { effectiveSpend, healthInputOf, kidsOf, monthlyEmi, termInputOf } from '../state/derive'

/** Everything a user would notice about one product, in one comparable shape. */
export interface Bundle {
  /** The headline amount: term cover to buy, or total health cover. */
  cover: number
  /** Indicative premium in rupees a year (mid), including the add-ons we suggest where we can price them. */
  premium: number
  takes: string[]
  considers: string[]
  flags: string[]
  /** Free-form headline facts, e.g. which base plans apply. */
  tags: string[]
}

const labelsOf = (rows: { label: string; verdict: string }[], v: 'take' | 'consider') => rows.filter((r) => r.verdict === v).map((r) => r.label)

export function termAddonRows(p: Profile): AddonRow[] {
  const input = termInputOf(p), t = computeTerm(input)
  return termAddons({ depends: p.dependents.length > 0, spouseEarns: p.dependents.includes('spouse') && p.spouseEarns, hasKids: kidsOf(p) > 0, age: p.age, monthlySpend: effectiveSpend(p), monthlyEmi: monthlyEmi(p), freeSavings: p.freeSavings, heavyCommute: p.heavyCommute, familyHistory: p.familyHistory, spouseManagesLumpSum: p.lumpSum, recommendedCover: t.recommended, existingCover: input.existingTerm })
}

export function healthAddonRows(p: Profile): AddonRow[] {
  const h = computeHealth(healthInputOf(p))
  return healthAddons({ city: p.city, hospital: p.hospital, members: 1 + (p.dependents.includes('spouse') ? 1 : 0) + kidsOf(p) + (p.babyPlanned ? 1 : 0), knownCondition: p.knownCondition, familyHistory: p.familyHistory, babyPlanned: p.babyPlanned, selfEmployedOrGig: p.selfEmployed, premiumPctOfIncome: h.premiumPctOfIncome, hasParents: p.dependents.includes('parents'), topUp: { verdict: h.topUp.recommended ? 'take' : 'skip', why: h.topUp.why, size: h.topUp.size }, savingsThin: p.freeSavings < 10 * LAKH })
}

export function termBundle(p: Profile): Bundle {
  const t = computeTerm(termInputOf(p))
  const rows = termAddonRows(p)
  return { cover: t.recommended, premium: t.premium.mid, takes: labelsOf(rows, 'take'), considers: labelsOf(rows, 'consider'), flags: t.flags.map((f) => f.text), tags: [`years:${t.N}`, `ceiling:${t.eligibility.binding}`] }
}

/** Health in step 2 is the base plans only: the family floater and a plan for each parent. The super top-up is an add-on. */
export function healthBundle(p: Profile): Bundle {
  const h = computeHealth(healthInputOf(p))
  const rows = healthAddonRows(p)
  return { cover: h.basePlans.totalCover, premium: h.basePlans.premium.mid, takes: labelsOf(rows, 'take'), considers: labelsOf(rows, 'consider'), flags: h.flags.map((f) => f.text), tags: [`base:${h.base}`, `trim:${h.trimmed}`, `topup:${h.topUp.recommended ? h.topUp.size : 0}`] }
}

export const bundleFor = (product: 'term' | 'health', p: Profile): Bundle => (product === 'term' ? termBundle(p) : healthBundle(p))
