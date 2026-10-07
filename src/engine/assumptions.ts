import { inr, inrFull } from './format'
import { hospitalLabel } from './health'
import { ageLabel, ccLabel } from './motor'
import { computeTerm } from './term'
import { effectiveLoans, effectiveParentSupport, effectiveSpend, hasLoanFlag, kidsOf, termInputOf } from '../state/derive'
import type { Product, Profile } from '../state/profile'

/** What an answer was built on. `suggested` means we filled it in and the user has not touched it. */
export interface Assumption {
  key: string
  value: string
  suggested: boolean
}

const cityWord = { metro: 'Big metro', tier2: 'Tier-2 city', other: 'Smaller town' } as const
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '')

export function assumptionsFor(product: Product, p: Profile): Assumption[] {
  const sug = (key: string) => !p.touched[key]
  const kids = kidsOf(p)
  const out: Assumption[] = []
  const add = (key: string, value: string, suggested: boolean) => out.push({ key, value, suggested })
  if (product === 'term') {
    const r = computeTerm(termInputOf(p))
    const who = [p.dependents.includes('spouse') && (p.spouseEarns ? 'spouse who earns' : 'spouse at home'), kids > 0 && `${kids} ${kids === 1 ? 'child' : 'children'}, youngest ${p.youngestChildAge}`, p.dependents.includes('parents') && 'parents'].filter(Boolean) as string[]
    add('Family', who.length ? list(who) : 'Nobody', who.length > 0 && (p.dependents.includes('spouse') && sug('spouseEarns') || kids > 0 && sug('youngestChildAge')))
    const goalNames = [...(kids > 0 ? [p.goalEducation && 'education', p.goalMarriage && 'marriage'] : []), ...p.goals.map((g) => g.label.toLowerCase())].filter(Boolean) as string[]
    if (kids > 0 || p.goals.length > 0) add('Big goals', goalNames.length ? list(goalNames) : 'None', kids > 0 && p.goals.length === 0 && sug('goalEducation') && sug('goalMarriage'))
    add('Household spending', `${inrFull(effectiveSpend(p))} a month`, p.monthlySpend === null)
    add('Loans', hasLoanFlag(p) ? inr(effectiveLoans(p)) : 'None', hasLoanFlag(p) && p.loans === null)
    if (p.dependents.length > 0 && r.N > 0) add('Years of support', `${r.N} years`, p.yearsOverride === null)
    if (p.dependents.includes('parents')) add('Support for parents', `${inrFull(effectiveParentSupport(p))} a month`, p.parentSupportMonthly === null)
    if (p.freeSavings > 0) add('Savings counted', inr(p.freeSavings), false)
    if (p.covered.includes('ownTerm') && p.existingTerm > 0) add('Term cover you hold', inr(p.existingTerm), false)
  } else if (product === 'health') {
    const who = ['you', p.dependents.includes('spouse') && 'spouse', kids > 0 && `${kids} ${kids === 1 ? 'child' : 'children'}`, p.babyPlanned && 'a baby planned'].filter(Boolean) as string[]
    add('Covering', list(who), false)
    add('City', cityWord[p.city], sug('city'))
    add('Hospitals you would use', hospitalLabel[p.hospital], sug('hospital'))
    if (p.dependents.includes('parents')) add('Parents', `${p.parents === 1 ? 'One' : 'Both'}, age ${p.parentAge}`, sug('parentAge'))
    add('Health plan you hold', p.covered.includes('ownHealth') && p.ownCover > 0 ? inr(p.ownCover) : 'None yet', false)
    add('A bill you could pay yourself', inr(p.savingsForBill), sug('savingsForBill'))
  } else {
    add('Vehicle', `${p.vehicleKind === 'car' ? 'Car' : 'Two-wheeler'}, ${p.vehicleKind === 'car' ? ccLabel.car[p.carCc] : ccLabel.bike[p.bikeCc]}`, sug('vehicleKind') && sug(p.vehicleKind === 'car' ? 'carCc' : 'bikeCc'))
    add('Age', ageLabel[p.vehicleAge], sug('vehicleAge'))
    add('Worth', inr(p.vehicleValue), sug('vehicleValue'))
    add('On a loan', p.owns.includes('vehicleLoan') ? 'Yes' : 'No', sug('owns'))
    add('No-claim bonus', p.ncb > 0 ? `${p.ncb}%` : 'None yet', sug('ncb'))
    add('Policy you hold', p.covered.includes('ownMotor') ? (p.motorPolicy === 'comprehensive' ? 'Comprehensive' : 'Third-party only') : 'None', false)
  }
  return out
}
