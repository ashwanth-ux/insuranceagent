import type { Gender } from './types'

export type Dependent = 'spouse' | 'children' | 'parents'
export type Owns = 'homeLoan' | 'vehicleLoan' | 'otherLoan' | 'car' | 'bike'
export type Covered = 'ownHealth' | 'employerHealth' | 'ownTerm' | 'employerLife' | 'savingsPlan' | 'ownMotor'

export interface NeedsInput {
  age: number
  gender: Gender
  smoker: boolean
  dependents: Dependent[]
  /** Annual income, rupees. */
  income: number
  owns: Owns[]
  covered: Covered[]
  /** The person has a big goal to fund (a house, a wedding, a business). */
  hasGoals?: boolean
  noIncome?: boolean
}

export type NeedId = 'health' | 'term' | 'topup' | 'parents' | 'motor' | 'ci'
export type NeedStatus = 'now' | 'have' | 'later' | 'notYet'

export interface Need {
  id: NeedId
  title: string
  status: NeedStatus
  /** One line, in the user's own terms. */
  reason: string
  /** Which sizing page this feeds. */
  product: 'health' | 'term' | 'motor' | null
  order: number
}

export type Stage = 'starting' | 'partnered' | 'family' | 'sandwich' | 'preRetirement' | 'retired'

export const stageLabel: Record<Stage, string> = {
  starting: 'Starting out',
  partnered: 'Partnered',
  family: 'Raising a family',
  sandwich: 'Supporting parents and children',
  preRetirement: 'Heading to retirement',
  retired: 'Retired',
}

export function stageOf(i: Pick<NeedsInput, 'age' | 'dependents'>): Stage {
  const d = new Set(i.dependents)
  if (i.age >= 60) return 'retired'
  if (i.age >= 50) return 'preRetirement'
  if (d.has('parents') && (d.has('children') || d.has('spouse'))) return 'sandwich'
  if (d.has('children')) return 'family'
  if (d.has('spouse')) return 'partnered'
  return 'starting'
}

export interface NeedsResult {
  stage: Stage
  headline: string
  needs: Need[]
  firstMove: Need | null
  flags: string[]
  /** Whether anyone relies on income or a loan is outstanding. */
  termRelevant: boolean
}

export function computeNeeds(i: NeedsInput): NeedsResult {
  const d = new Set(i.dependents)
  const o = new Set(i.owns)
  const c = new Set(i.covered)
  const stage = stageOf(i)
  const hasLoan = o.has('homeLoan') || o.has('vehicleLoan') || o.has('otherLoan')
  const depends = d.size > 0
  const termRelevant = depends || hasLoan || !!i.hasGoals
  const vehicle = o.has('car') || o.has('bike')
  const needs: Need[] = []
  const flags: string[] = []

  // 1. Individual health
  needs.push(
    c.has('ownHealth')
      ? { id: 'health', title: 'Health plan of your own', status: 'have', reason: 'You have one. Check it is big enough and has no room-rent cap.', product: 'health', order: 1 }
      : { id: 'health', title: 'Health plan of your own', status: 'now', product: 'health', order: 1,
          reason: c.has('employerHealth') ? 'Employer cover ends with the job, and waiting periods only start when you buy.' : 'One hospital stay can wipe out savings. Waiting periods start only when you buy, so buy early.' },
  )

  // 2. Term
  if (i.age > 65) {
    needs.push({ id: 'term', title: 'Term life cover', status: 'notYet', reason: 'Most insurers do not sell new term cover after 65. Put weight on health cover.', product: null, order: 2 })
  } else if (c.has('ownTerm') && termRelevant) {
    needs.push({ id: 'term', title: 'Term life cover', status: 'have', reason: 'You hold some. Check it matches what your family would need.', product: 'term', order: 2 })
  } else if (termRelevant) {
    const why = [d.has('spouse') && 'your spouse', d.has('children') && 'your children', d.has('parents') && 'your parents', hasLoan && 'a loan', !!i.hasGoals && 'a goal you are saving for'].filter(Boolean) as string[]
    needs.push({ id: 'term', title: 'Term life cover', status: 'now', product: 'term', order: 2, reason: i.noIncome ? 'Replacing the work you do (childcare, help, running the home) would cost real money. A modest policy is sensible. Insurers usually cap it at a share of your earning spouse’s cover.' : `${why.length > 1 ? why.slice(0, -1).join(', ') + ' and ' + why.slice(-1) : why[0]} would feel the loss of your income.`.replace(/^./, (x) => x.toUpperCase()) })
  } else {
    needs.push({ id: 'term', title: 'Term life cover', status: 'notYet', product: 'term', order: 2, reason: 'Nobody depends on your income and you owe nothing. A small plan now locks a low price, but it is optional. Revisit with your first dependant or loan.' })
  }

  // 3. Super top-up
  needs.push({ id: 'topup', title: 'Health super top-up', status: c.has('ownHealth') ? 'now' : 'later', product: 'health', order: 3, reason: 'The cheap way to stretch a ₹10 lakh plan to ₹25 lakh or more. Worth adding if your hospitals, health history or savings call for it. The base plan comes first.' })

  // 4. Parents
  if (d.has('parents')) needs.push({ id: 'parents', title: 'Separate health plans for your parents', status: 'now', product: 'health', order: 4, reason: 'Their claims would drain your family’s shared limit, and their waiting periods start only when you buy.' })

  // 5. Motor
  if (vehicle) needs.push({ id: 'motor', title: o.has('car') ? 'Car insurance' : 'Two-wheeler insurance', status: c.has('ownMotor') ? 'have' : 'now', product: 'motor', order: 5, reason: c.has('ownMotor') ? 'You have one. Check it is the right type and the insured value is fair.' : 'Third-party cover is the law. Own-damage cover is your choice, and worth it if you could not replace the vehicle from savings.' })

  // 6. CI and PA
  needs.push({ id: 'ci', title: 'Critical illness and personal accident', status: 'later', product: null, order: 6, reason: 'Last in line. They replace income while you recover, which nothing else does. Add them once the cover above is in place.' })

  if (c.has('savingsPlan')) flags.push('Endowment, money-back and ULIP plans are savings with a small cover attached. We count only their life cover as protection.')
  if (c.has('employerHealth') && !c.has('ownHealth')) flags.push('Your health cover would vanish if you left or lost your job.')
  if (c.has('employerLife') && !c.has('ownTerm')) flags.push('Your life cover is through your employer. It would end with the job, so we do not count it.')

  const ordered = needs.sort((a, b) => a.order - b.order)
  const actionable = ordered.filter((n) => n.status === 'now')
  const nowCount = actionable.length
  const headline =
    nowCount === 0
      ? 'You are covered on the essentials. Let’s check the amounts.'
      : `${nowCount === 1 ? 'One thing needs' : `${nowCount} things need`} your attention now.`

  return { stage, headline, needs: ordered, firstMove: actionable[0] ?? null, flags, termRelevant }
}
