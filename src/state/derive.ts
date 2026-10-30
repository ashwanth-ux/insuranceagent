import { approxEmi } from '../engine/addons'
import { LAKH, clamp, roundTo } from '../engine/format'
import type { HealthInput } from '../engine/health'
import { LIMITS } from '../engine/limits'
import type { NeedsInput } from '../engine/needs'
import { defaultGoals, type Goal, type TermInput, TERM_ASSUMPTIONS } from '../engine/term'
import type { Profile } from './profile'

/** About 65% of take-home goes to household spending (field guide: 60–70%), and take-home is about 85% of gross. */
export const SPEND_SHARE_OF_GROSS = 0.55

export const estimateMonthlySpend = (income: number) => clamp(roundTo((income / 12) * SPEND_SHARE_OF_GROSS, 1000), LIMITS.monthlySpend.min, LIMITS.monthlySpend.max)

/** Used only when the user has a loan but has not told us the amount. */
export function estimateLoans(p: Pick<Profile, 'income' | 'owns'>): number {
  const o = new Set(p.owns)
  let v = 0
  if (o.has('homeLoan')) v += 2.5 * p.income
  if (o.has('vehicleLoan')) v += 0.3 * p.income
  if (o.has('otherLoan')) v += 0.4 * p.income
  return clamp(roundTo(v, 50_000), 0, LIMITS.loans.max)
}

export const hasLoanFlag = (p: Pick<Profile, 'owns'>) => p.owns.includes('homeLoan') || p.owns.includes('vehicleLoan') || p.owns.includes('otherLoan')

export const effectiveSpend = (p: Profile) => p.monthlySpend ?? estimateMonthlySpend(p.income)
export const effectiveParentSupport = (p: Profile) => (p.dependents.includes('parents') ? p.parentSupportMonthly ?? LIMITS.parentSupport.default : 0)
export const effectiveLoans = (p: Profile) => (hasLoanFlag(p) ? p.loans ?? estimateLoans(p) : 0)

export function kidsOf(p: Profile) {
  return p.dependents.includes('children') ? p.kids : 0
}

export function termGoals(p: Profile): Goal[] {
  const kids = kidsOf(p)
  const goals: Goal[] = []
  if (kids > 0 && p.goalEducation) goals.push(...defaultGoals(kids, p.youngestChildAge))
  if (kids > 0 && p.goalMarriage) goals.push({ id: 'marriage', label: kids > 1 ? 'Marriage for your children' : 'Child’s marriage', todayCost: 25 * LAKH * kids, yearsAway: Math.max(0, 28 - p.youngestChildAge), inflation: TERM_ASSUMPTIONS.marriageInflation })
  // Goals the person adds themselves count whether or not anyone depends on them: a house, their own wedding, a business.
  for (const g of p.goals) goals.push({ id: 'other', label: g.label, todayCost: g.todayCost, yearsAway: g.yearsAway, inflation: TERM_ASSUMPTIONS.inflation })
  return goals
}

export function termInputOf(p: Profile): TermInput {
  const spouse = p.dependents.includes('spouse') ? (p.spouseEarns ? 'earning' : 'homemaker') : 'none'
  return {
    age: p.age, gender: p.gender, smoker: p.smoker, income: p.income, monthlySpend: effectiveSpend(p),
    spouse, kids: kidsOf(p), youngestChildAge: p.youngestChildAge, dependentParents: p.dependents.includes('parents'),
    loans: effectiveLoans(p), goals: termGoals(p), freeSavings: p.freeSavings, existingTerm: p.covered.includes('ownTerm') ? p.existingTerm : 0,
    employerLife: p.covered.includes('employerLife') ? 1 : 0, yearsOverride: p.yearsOverride ?? undefined, noIncome: p.noIncome,
    parentSupportYearly: effectiveParentSupport(p) * 12, parentAge: p.parentAge,
  }
}

export function healthInputOf(p: Profile): HealthInput {
  return {
    age: p.age, spouse: p.dependents.includes('spouse'), kids: kidsOf(p), parents: p.dependents.includes('parents') ? p.parents : 0, parentAge: p.parentAge,
    city: p.city, hospital: p.hospital, ownCover: p.covered.includes('ownHealth') ? p.ownCover : 0, employerCover: p.covered.includes('employerHealth') ? p.employerCover : 0,
    knownCondition: p.knownCondition, familyHistory: p.familyHistory, babyPlanned: p.babyPlanned, savingsForBill: p.savingsForBill, income: p.income, noIncome: p.noIncome,
  }
}


export function needsInputOf(p: Profile): NeedsInput {
  return { age: p.age, gender: p.gender, smoker: p.smoker, dependents: p.dependents, income: p.income, owns: p.owns, covered: p.covered, noIncome: p.noIncome, hasGoals: p.goals.length > 0 }
}

export const monthlyEmi = (p: Profile) => approxEmi(effectiveLoans(p))
