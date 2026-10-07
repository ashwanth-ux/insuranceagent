import { TERM_PLANS, type TermPlan } from '../data/plans'
import { termPremium } from './term'
import type { Gender, Range } from './types'
import { roundTo } from './format'

const keys = (g: Gender) => (g === 'female' ? (['f25', 'f35'] as const) : (['m25', 'm35'] as const))

/** A plan's price relative to the ten-plan average, from Ditto's four benchmark profiles. 1.00 = average. */
export function priceIndex(plan: TermPlan, gender: Gender): number {
  const ks = keys(gender)
  const idx = ks.map((k) => plan.premium[k] / (TERM_PLANS.reduce((s, p) => s + p.premium[k], 0) / TERM_PLANS.length))
  return idx.reduce((a, b) => a + b, 0) / idx.length
}

/** Indicative premium for this person on this plan: our calibrated model, scaled by the plan's relative price. */
export function planPremium(plan: TermPlan, i: { age: number; gender: Gender; smoker: boolean; cover: number; coverToAge: number }): Range {
  const base = termPremium(i).mid
  const m = base * priceIndex(plan, i.gender)
  return { low: roundTo(m * 0.94, 100), mid: roundTo(m, 100), high: roundTo(m * 1.06, 100) }
}
