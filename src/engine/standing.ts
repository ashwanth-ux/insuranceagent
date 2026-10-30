import { inr, inrFull, roundTo } from './format'
import { computeHealth, type HealthPlan } from './health'
import { computeTerm } from './term'
import type { Profile } from '../state/profile'
import { healthInputOf, termInputOf } from '../state/derive'

/**
 * Where the user stands against what we would recommend. When they are already there, that is the headline:
 * we say so, show how far ahead they are, and list only what is left to keep it that way.
 */
export interface Standing {
  kind: 'sorted' | 'partly' | 'fresh'
  /** Shown as the hero when kind is 'sorted'. */
  headline: string
  sub: string
  /** What you hold, what we would aim for, for the progress bar. */
  have: number
  target: number
  haveLabel: string
  targetLabel: string
  /** Only what is left to do. Short. */
  keep: string[]
  /** Hero for 'partly': the amount still to add. */
  addLabel: string
  add: number
  /** False when there is no amount to measure progress against. */
  bar: boolean
}

export function healthStanding(p: Profile): Standing {
  const r = computeHealth(healthInputOf(p))
  const own = p.covered.includes('ownHealth') ? p.ownCover : 0
  const keep: string[] = []
  if (r.baseStanding === 'sorted') {
    keep.push('Read the policy wording for a room-rent cap, a co-pay and disease sub-limits. A large number with a cap pays less than it looks.')
    if (p.babyPlanned) keep.push(`Check that your plan covers maternity and when the waiting period ends. If it does not, adding it costs roughly ${inrFull(r.maternityOption.premium.low)} to ${inrFull(r.maternityOption.premium.high)} a year. Do it before you try to conceive.`)
    if (p.knownCondition) keep.push(`Make sure the condition is disclosed on your current plan. After ${r.waits.moratorium} months of continuous cover the insurer cannot contest it, so never let the plan lapse.`)
    if (p.dependents.includes('spouse') || p.dependents.includes('children')) keep.push('Confirm everyone you want covered is on the plan, and that a newborn is covered from day one.')
    keep.push(`Review every three to five years. At 12% medical inflation, ${inr(own)} buys what ${inr(roundTo((own * r.decay[1].value) / 10_00_000, 1000))} buys today in 10 years.`)
  }
  const ahead = r.baseSurplus
  return {
    kind: r.baseStanding,
    headline: 'Your base plan is already sorted.',
    sub: ahead > 0
      ? `Your ${inr(own)} is ${inr(ahead)} above the ${inr(r.base)} base plan we would suggest.${r.parents ? ' Your parents still need their own plans.' : ''}`
      : `Your ${inr(own)} is right at the ${inr(r.base)} base plan we would suggest.${r.parents ? ' Your parents still need their own plans.' : ''}`,
    have: own, target: r.base, haveLabel: `You hold ${inr(own)}`, targetLabel: `Base plan ${inr(r.base)}`,
    keep, addLabel: 'Below a clean base plan by', add: Math.max(0, r.base - own), bar: true,
  }
}

export function termStanding(p: Profile): Standing {
  const r = computeTerm(termInputOf(p))
  const existing = r.existing
  const keep: string[] = []
  if (r.standing === 'sorted') {
    keep.push(`Check that the plan you hold runs until at least age ${r.coverToAge}, and that it is an individual plan, not employer cover.`)
    keep.push('Confirm the nominee is current and your family knows where the policy is.')
    keep.push('Review when a child arrives, a loan is taken or income changes sharply. Those are the moments the need grows.')
    if (p.dependents.length > 0 && !p.noIncome) keep.push('A waiver-of-premium rider is worth checking. It keeps the cover alive if you cannot work.')
  }
  return {
    kind: r.standing,
    headline: 'You are already sorted.',
    sub: r.grossNeed > 0
      ? r.surplus > 0 ? `Your ${inr(existing)} of term cover is ${inr(r.surplus)} above the ${inr(r.grossNeed)} we calculate for your family.`
        : r.gapTooSmall ? `Your ${inr(existing)} of term cover is about ${inr(roundTo(r.need.mid, 1000))} short of the ${inr(r.grossNeed)} we calculate for your family. That is too small for a policy of its own, so there is nothing to add.`
        : `Your ${inr(existing)} of term cover matches the ${inr(r.grossNeed)} we calculate for your family.`
      : `You hold ${inr(existing)} of term cover. Nobody depends on your income and you owe nothing, so there is nothing to add yet.`,
    have: existing, target: Math.max(r.grossNeed, existing === 0 ? 0 : r.grossNeed), haveLabel: `You hold ${inr(existing)}`, targetLabel: `Need ${inr(r.grossNeed)}`,
    keep, addLabel: 'Extra term cover to add', add: r.recommended, bar: true,
  }
}

export interface PlanView extends Omit<HealthPlan, 'role'> {
  role: HealthPlan['role'] | 'have'
}

/** The base plans to show, tuned to what the user already holds: nothing for the family if the base is in place, only the parents' plans. */
export function healthPlansView(p: Profile): PlanView[] {
  const r = computeHealth(healthInputOf(p))
  const own = p.covered.includes('ownHealth') ? p.ownCover : 0
  const parents = r.plans.filter((x) => x.id === 'parent')
  if (r.baseStanding === 'sorted') return parents
  if (r.baseStanding === 'partly') {
    const zero = { low: 0, mid: 0, high: 0 }
    return [{ id: 'base', group: 'family', title: 'Your current plan', short: 'Your plan', cover: own, role: 'have', premium: zero, why: `Keep it. A clean base for your family is ${inr(r.base)}: raise the sum insured at renewal, or cover the gap with a super top-up in the next step.` }, ...parents]
  }
  return r.plans
}
