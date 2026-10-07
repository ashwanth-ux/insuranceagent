import { LAKH, inr, roundUpTo } from './format'
import { termAgeFactor } from './term'
import type { Range, Verdict } from './types'

export interface AddonRow {
  id: string
  product: 'term' | 'health'
  label: string
  verdict: Verdict
  /** Why, in terms of the user's own answers. */
  reason: string
  /** Honest price tag: only numbers we can stand behind, else a band. */
  cost?: string
  /** Extra caution from the playbook. */
  watch?: string
}

export interface TermAddonInput {
  depends: boolean
  spouseEarns: boolean
  hasKids: boolean
  age: number
  monthlySpend: number
  monthlyEmi: number
  freeSavings: number
  heavyCommute: boolean
  familyHistory: boolean
  spouseManagesLumpSum: 'yes' | 'no' | 'unsure'
  recommendedCover: number
  existingCover: number
}

/** Critical-illness cover: out-of-pocket treatment gap + 24 months of household cash needs, rounded up to ₹5L. */
export function ciCover(monthlySpend: number, monthlyEmi: number, treatmentGap = 10 * LAKH, months = 24) {
  const need = treatmentGap + months * (monthlySpend + monthlyEmi)
  return { need, rounded: roundUpTo(need, 5 * LAKH) }
}

/**
 * What the riders we recommend add to a term premium. Anchors: waiver of premium ₹1,500–2,500 a year (Pranay Kapoor), and CI plus waiver together
 * ₹3,500–5,500 a year for a 30-year-old at ₹1 crore (aggregator rider comparison). Scaled by the same age curve as the base premium.
 * The CI amount does not scale it, so treat it as indicative.
 */
export function termRiderCost(age: number, wop: boolean, ci: boolean): Range {
  const f = termAgeFactor(age) / termAgeFactor(30)
  const low = (wop ? 1500 : 0) + (ci ? 2000 : 0)
  const high = (wop ? 2500 : 0) + (ci ? 3000 : 0)
  const r = (v: number) => Math.round((v * f) / 100) * 100
  return { low: r(low), mid: r((low + high) / 2), high: r(high) }
}

/** Approximate EMI for loans we know only by balance: 20 years at 8.75%. */
export function approxEmi(balance: number, years = 20, annualRate = 0.0875): number {
  if (balance <= 0) return 0
  const r = annualRate / 12
  const n = years * 12
  return (balance * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

export function termAddons(i: TermAddonInput): AddonRow[] {
  const ci = ciCover(i.monthlySpend, i.monthlyEmi)
  const monthsOfRunway = i.monthlySpend + i.monthlyEmi > 0 ? i.freeSavings / (i.monthlySpend + i.monthlyEmi) : 99
  const mainSupport = i.depends && (!i.spouseEarns || i.hasKids)
  const rows: AddonRow[] = []

  rows.push({
    id: 'wop', product: 'term', label: 'Waiver of premium',
    verdict: mainSupport ? 'take' : i.depends ? 'consider' : 'skip',
    reason: mainSupport ? 'Your income is the family’s main support, so the policy should survive if you cannot work.' : i.depends ? 'Your spouse also earns, so it matters less. It is still cheap.' : 'Nobody depends on your income.',
    cost: 'Usually cheap', watch: 'Read how the policy defines disability. A narrow definition makes it useless.',
  })

  const ciTake = i.depends && monthsOfRunway < 24
  rows.push({
    id: 'ci', product: 'term', label: 'Critical illness cover',
    verdict: ciTake || i.familyHistory ? 'take' : i.depends ? 'consider' : 'skip',
    reason: i.familyHistory
      ? 'There is serious illness in your family. This pays a lump sum on diagnosis.'
      : ciTake ? `Your savings would carry the household for about ${Math.max(0, Math.floor(monthsOfRunway))} months. One to two years of lost income during a recovery is the gap this fills.` : i.depends ? 'Your savings could carry the household through a long recovery.' : 'Nobody depends on your income.',
    cost: ciTake || i.familyHistory ? `About ${inr(ci.rounded)} of cover` : undefined,
    watch: 'Prefer additional cover (pays on top of death cover) over accelerated (reduces it). A standalone plan is cleaner for a bigger amount.',
  })

  rows.push({
    id: 'raise', product: 'term', label: 'Option to raise cover at marriage, a child or a home loan',
    verdict: i.age <= 35 && i.existingCover + i.recommendedCover > 0 && !i.hasKids ? 'take' : i.age <= 38 ? 'consider' : 'skip',
    reason: i.age <= 35 ? 'You are young and your income is likely to grow. It lets you add cover later without fresh medical tests.' : 'Your needs are mostly in place. Take it only if you are holding back from your full number today.',
    cost: 'Small',
  })

  rows.push({
    id: 'payout', product: 'term', label: 'Monthly income payout, or lump sum plus monthly',
    verdict: i.spouseManagesLumpSum === 'no' ? 'take' : i.spouseManagesLumpSum === 'unsure' ? 'consider' : 'skip',
    reason: i.spouseManagesLumpSum === 'no' ? 'The person receiving the money is not used to managing a large sum. Monthly income protects them.' : i.spouseManagesLumpSum === 'unsure' ? 'If you are not sure, lump sum plus monthly is a safe middle path.' : 'A plain lump sum is simpler and more flexible.',
  })

  rows.push({
    id: 'adb', product: 'term', label: 'Accidental death benefit',
    verdict: i.heavyCommute ? 'consider' : 'skip',
    reason: i.heavyCommute ? 'You travel or commute heavily. Take it only if it costs under about 10% of your base premium.' : 'It pays only for accidents and never replaces base cover.',
  })

  rows.push({ id: 'rop', product: 'term', label: 'Return of premium', verdict: 'skip', reason: 'It costs two to three times plain term and refunds only your own money, years later. Buy plain term and invest the difference.' })
  rows.push({ id: 'savings', product: 'term', label: 'Savings, money-back or ULIP “life plans”', verdict: 'skip', reason: 'Not term cover. The cover is usually tiny. Keep protection and investing separate.' })

  return rows
}

export interface HealthAddonInput {
  city: 'metro' | 'tier2' | 'other'
  hospital: 'top' | 'standard' | 'local'
  members: number
  knownCondition: boolean
  familyHistory: boolean
  babyPlanned: boolean
  selfEmployedOrGig: boolean
  premiumPctOfIncome: number
  hasParents: boolean
  /** The super top-up, as the engine sizes it. It is offered here and only here, so it is never counted twice. */
  topUp: { verdict: Verdict; why: string; size: number }
  savingsThin: boolean
}

export function healthAddons(i: HealthAddonInput): AddonRow[] {
  const rows: AddonRow[] = []
  rows.push({ id: 'stu', product: 'health', label: 'Super top-up', verdict: i.topUp.verdict, reason: i.topUp.why, watch: 'Give it the same room-rent and sub-limit terms you want on the base. A top-up with caps undoes a clean base.' })
  rows.push({ id: 'room', product: 'health', label: 'No room-rent cap', verdict: 'take', reason: 'A cap also shrinks doctor, nursing and OT charges in the same ratio. A ₹2 lakh bill can leave you paying ₹75,000.', watch: 'Any plan with a cap and proportionate deduction is cheap for a reason.' })
  rows.push({ id: 'restore', product: 'health', label: 'Restoration of cover after a claim', verdict: i.members > 1 && i.topUp.verdict !== 'take' ? 'take' : 'consider', reason: i.members > 1 ? 'On a family floater more than one person can claim in a year. It is usually built in.' : 'Usually built in. Do not pay a large extra when a super top-up already sits above.' })
  rows.push({ id: 'consum', product: 'health', label: 'Cover for consumables and non-payables', verdict: i.hospital === 'top' ? 'take' : 'consider', reason: i.hospital === 'top' ? 'Private hospitals bill gloves, masks and admin items that add up.' : 'Worth it only if the price is a small slice of the premium.' })
  rows.push({ id: 'ped', product: 'health', label: 'Shorter waiting period for existing conditions', verdict: i.knownCondition ? 'take' : 'skip', reason: i.knownCondition ? 'Compare the number of months across insurers. The legal maximum is 36. Fewer is better.' : 'You have no known conditions.' })
  rows.push({ id: 'maternity', product: 'health', label: 'Maternity cover', verdict: i.babyPlanned ? 'take' : 'skip', reason: i.babyPlanned ? 'The waiting period is typically two to four years, so buy early.' : 'No baby planned. It adds cost and the benefit is capped.' })
  rows.push({ id: 'copay', product: 'health', label: 'Voluntary co-pay (you share each claim)', verdict: i.hasParents && i.premiumPctOfIncome > 6 ? 'consider' : 'skip', reason: i.hasParents && i.premiumPctOfIncome > 6 ? 'Your premiums are stretched. A 10 to 20% co-pay on your parents’ plans lowers the cost.' : 'You would pay at the worst moment. Avoid it on your own plan.' })
  rows.push({ id: 'cihealth', product: 'health', label: 'Standalone critical illness plan', verdict: i.familyHistory || i.savingsThin ? 'take' : 'consider', reason: i.familyHistory ? 'Strong family history. It pays a lump sum on diagnosis, whatever the bill.' : i.savingsThin ? 'Your savings are thin. Do it after base health, term and super top-up.' : 'After the core cover is done.' })
  rows.push({ id: 'pa', product: 'health', label: 'Personal accident cover', verdict: i.selfEmployedOrGig ? 'take' : 'skip', reason: i.selfEmployedOrGig ? 'You would lose income while injured, and no sick leave to fall back on.' : 'Salaried with sick leave and term cover.' })
  rows.push({ id: 'opd', product: 'health', label: 'OPD (doctor visits and medicines) cover', verdict: 'skip', reason: 'The premium tends to be close to the benefit. It is a way of paying yourself back.' })
  rows.push({ id: 'cash', product: 'health', label: 'Hospital daily cash, disease-specific and international cover', verdict: 'skip', reason: 'Skip unless you will be treated abroad.' })
  return rows
}

export const verdictRank: Record<Verdict, number> = { take: 0, consider: 1, skip: 2 }
export const sortAddons = (rows: AddonRow[]) => [...rows].sort((a, b) => verdictRank[a.verdict] - verdictRank[b.verdict])
