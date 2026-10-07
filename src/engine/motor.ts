import { LAKH, CRORE, clamp, inr, roundTo } from './format'
import type { Flag, Range, Step } from './types'

export type VehicleKind = 'car' | 'bike'
export type CarCc = 'upto1000' | '1000to1500' | 'above1500'
export type BikeCc = 'upto75' | '75to150' | '150to350' | 'above350'
export type VehicleAge = 'lt6m' | '6m1y' | '1to2' | '2to3' | '3to4' | '4to5' | '5plus'

export const AGE_ORDER: VehicleAge[] = ['lt6m', '6m1y', '1to2', '2to3', '3to4', '4to5', '5plus']
export const ageLabel: Record<VehicleAge, string> = {
  lt6m: 'Under 6 months', '6m1y': '6 months to 1 year', '1to2': '1 to 2 years', '2to3': '2 to 3 years', '3to4': '3 to 4 years', '4to5': '4 to 5 years', '5plus': 'Over 5 years',
}

/** IRDAI depreciation slabs for IDV. Over 5 years the figure is agreed with the insurer. */
export const IDV_DEPRECIATION: Record<Exclude<VehicleAge, '5plus'>, number> = { lt6m: 0.05, '6m1y': 0.15, '1to2': 0.2, '2to3': 0.3, '3to4': 0.4, '4to5': 0.5 }

/** Third-party premium, notified by the government (1 June 2022 rates), ex-GST. A revision has been proposed, not confirmed. */
export const TP_PREMIUM: { car: Record<CarCc, number>; bike: Record<BikeCc, number> } = {
  car: { upto1000: 2_094, '1000to1500': 3_416, above1500: 7_897 },
  bike: { upto75: 538, '75to150': 714, '150to350': 1_366, above350: 2_804 },
}

export const ccLabel = {
  car: { upto1000: 'Up to 1,000 cc', '1000to1500': '1,000 to 1,500 cc', above1500: 'Above 1,500 cc' },
  bike: { upto75: 'Up to 75 cc', '75to150': '75 to 150 cc', '150to350': '150 to 350 cc', above350: 'Above 350 cc' },
} as const

/** No-claim bonus after 1…5 claim-free years. */
export const NCB_SLABS = [0, 20, 25, 35, 45, 50] as const
export const ncbAfterYears = (years: number) => NCB_SLABS[clamp(Math.floor(years), 0, 5)]
export const nextNcb = (current: number) => {
  const i = NCB_SLABS.findIndex((s) => s >= current)
  return NCB_SLABS[clamp((i < 0 ? 5 : i) + 1, 0, 5)]
}

export const MOTOR_MODEL = {
  gst: 0.18,
  /** Own-damage rate on IDV before NCB. Calibrated to the playbook example: ₹14L IDV, 35% NCB → ₹15,621 incl. GST for the base policy. */
  odRate: { car: 0.0108, bike: 0.017 },
  odAgeLoad: { lt6m: 0.95, '6m1y': 0.95, '1to2': 1.0, '2to3': 1.0, '3to4': 1.08, '4to5': 1.08, '5plus': 1.2 } satisfies Record<VehicleAge, number>,
  /** Owner-driver personal accident cover of ₹15 lakh is compulsory. Premium to be verified against the current notification. */
  ownerDriverPA: 330,
  totalLossShare: 0.75,
  /** Voluntary deductible discount on the OD premium (₹2,500 → ~10%, ₹5,000 → ~20%): rough industry practice. */
  voluntaryDeductible: { 0: 0, 2500: 0.1, 5000: 0.2 } as Record<number, number>,
  compulsoryDeductible: { car: { upto1000: 1000, '1000to1500': 1000, above1500: 2000 } as Record<CarCc, number>, bike: 0 },
  spread: { low: 0.8, high: 1.35 },
  /** Property-damage limit for third parties (private cars). */
  tpPropertyLimit: 7.5 * LAKH,
} as const

export interface AddOnSpec {
  id: string
  label: string
  /** Typical annual price ex-GST for a car; scaled for bikes. Aggregator estimates, wide ranges. */
  car: [number, number]
  note: string
}

export const MOTOR_ADDONS: AddOnSpec[] = [
  { id: 'zeroDep', label: 'Zero depreciation', car: [900, 5000], note: 'No deduction for age on replaced parts. Many policies limit it to two claims a year.' },
  { id: 'consumables', label: 'Consumables', car: [300, 900], note: 'Oil, coolant, nuts and bolts. Cheap and rarely refused. Take it with zero depreciation.' },
  { id: 'ncbProtect', label: 'NCB protect', car: [500, 1500], note: 'Keeps your bonus after a claim. Check how many claims it covers.' },
  { id: 'engineProtect', label: 'Engine protect', car: [500, 1500], note: 'Water damage and oil leak. Do not restart the engine after water gets in, or the claim can be void.' },
  { id: 'rti', label: 'Return to invoice', car: [500, 1500], note: 'Pays the invoice price if stolen or written off.' },
  { id: 'rsa', label: 'Roadside assistance', car: [300, 800], note: 'Towing and breakdown help. You may already have it from the maker or a credit card.' },
]

export const BIKE_ADDON_SCALE = 0.4

export interface MotorInput {
  kind: VehicleKind
  carCc: CarCc
  bikeCc: BikeCc
  age: VehicleAge
  /** Ex-showroom price when new (under 5 years) or what it would sell for today (over 5 years). */
  value: number
  onLoan: boolean
  couldReplace: boolean
  floodProne: boolean
  highwayHeavy: boolean
  streetParking: boolean
  ncb: number
  claimSmallDents: boolean
  carriesPassengers: boolean
  hasPA15L: boolean
  income: number
}

export const valueBounds = (kind: VehicleKind, age: VehicleAge) =>
  kind === 'car'
    ? age === '5plus' ? { min: 40_000, max: 1.5 * CRORE, step: 10_000, default: 3 * LAKH } : { min: 3 * LAKH, max: 3 * CRORE, step: 25_000, default: 8 * LAKH }
    : age === '5plus' ? { min: 8_000, max: 15 * LAKH, step: 2_000, default: 40_000 } : { min: 40_000, max: 40 * LAKH, step: 5_000, default: 1.2 * LAKH }

export function computeIdv(kind: VehicleKind, age: VehicleAge, value: number): number {
  const b = valueBounds(kind, age)
  const v = clamp(value, b.min, b.max)
  if (age === '5plus') return roundTo(v, 1000)
  return roundTo(v * (1 - IDV_DEPRECIATION[age]), 1000)
}

export interface MotorResult {
  idv: number
  idvRange: Range
  depreciation: number | null
  recommended: 'comprehensive' | 'thirdPartyOnly'
  why: string[]
  tp: number
  od: { gross: number; ncbDiscount: number; net: number }
  addons: { id: string; label: string; price: Range | null; priceNote?: string; note: string; verdict: 'take' | 'consider' | 'skip'; reason: string }[]
  premium: { thirdPartyOnly: Range; comprehensive: Range; withAddons: Range }
  ncb: number
  compulsoryDeductible: number
  totalLossAt: number
  flags: Flag[]
  steps: Step[]
  tpPropertyLimit: number
}

const withGst = (n: number) => n * (1 + MOTOR_MODEL.gst)

export function computeMotor(i: MotorInput): MotorResult {
  const M = MOTOR_MODEL
  const idv = computeIdv(i.kind, i.age, i.value)
  const tp = i.kind === 'car' ? TP_PREMIUM.car[i.carCc] : TP_PREMIUM.bike[i.bikeCc]
  const ncb = (NCB_SLABS as readonly number[]).includes(i.ncb) ? i.ncb : NCB_SLABS.reduce((a, s) => (s <= i.ncb ? s : a), 0)
  const odGross = idv * M.odRate[i.kind] * M.odAgeLoad[i.age]
  const ncbDiscount = odGross * (ncb / 100)
  const odNet = odGross - ncbDiscount
  const pa = M.ownerDriverPA * (i.hasPA15L ? 0 : 1)

  const why: string[] = []
  const youngVehicle = i.age !== '5plus'
  const tpOnlyOk = !i.onLoan && i.couldReplace && !youngVehicle
  if (i.onLoan) why.push('A vehicle on a loan needs own-damage cover. The lender expects it.')
  if (!i.couldReplace) why.push('You could not replace it or pay a major repair from savings.')
  if (youngVehicle) why.push('Under five years old, so a loss would cost real money.')
  if (tpOnlyOk) why.push('Older vehicle you could replace from savings. Third-party only is reasonable. You pay for your own damage.')
  const recommended = tpOnlyOk ? 'thirdPartyOnly' : 'comprehensive'

  // Add-on verdicts, driven by the answers (playbook motor §2).
  const scale = i.kind === 'car' ? 1 : BIKE_ADDON_SCALE
  const priceOf = (spec: AddOnSpec): Range => {
    const t = clamp(idv / (20 * LAKH), 0, 1)
    const lo = spec.car[0] * scale, hi = spec.car[1] * scale
    const mid = lo + (hi - lo) * Math.max(0.15, t)
    return { low: roundTo(lo, 50), mid: roundTo(mid, 50), high: roundTo(hi, 50) }
  }
  const verdicts: Record<string, { verdict: 'take' | 'consider' | 'skip'; reason: string }> = {}
  const under5 = i.age !== '5plus'
  const under3 = ['lt6m', '6m1y', '1to2', '2to3'].includes(i.age)
  verdicts.zeroDep = under5
    ? { verdict: 'take', reason: 'Your vehicle is under five years old, so a 30 to 50% parts deduction would hurt.' }
    : { verdict: 'skip', reason: 'An older vehicle. The extra cost rarely pays back.' }
  verdicts.consumables = under5 ? { verdict: 'take', reason: 'Cheap, and pairs with zero depreciation.' } : { verdict: 'consider', reason: 'Cheap. Worth it if you take zero depreciation.' }
  verdicts.ncbProtect = ncb >= 35
    ? { verdict: 'take', reason: `Your bonus is ${ncb}%. One claim would wipe it out.` }
    : ncb > 0 ? { verdict: 'consider', reason: `Your bonus is ${ncb}%. Worth it only if you expect to claim.` } : { verdict: 'skip', reason: 'You have no bonus to protect.' }
  verdicts.engineProtect = i.floodProne
    ? { verdict: 'take', reason: 'You drive or park near flood-prone areas.' }
    : { verdict: 'skip', reason: 'You do not drive in flood-prone areas.' }
  verdicts.rti = under3 && (i.onLoan || i.age === 'lt6m' || i.age === '6m1y' || i.age === '1to2') ? { verdict: 'take', reason: 'New or on a loan, so the invoice price matters if it is stolen or written off.' } : { verdict: 'skip', reason: 'An older vehicle where it adds little.' }
  verdicts.rsa = i.highwayHeavy ? { verdict: 'consider', reason: 'Long highway runs. Check whether the maker or your credit card already gives it.' } : { verdict: 'skip', reason: 'You mostly drive in town. Do not pay twice.' }

  verdicts.passenger = i.carriesPassengers
    ? { verdict: 'take', reason: 'You regularly carry family or colleagues, and their own health or accident cover may not respond.' }
    : { verdict: 'skip', reason: 'You mostly ride alone, and your own accident and health cover respond for you.' }
  const addons: MotorResult['addons'] = [
    ...MOTOR_ADDONS.map((a) => ({ id: a.id, label: a.label, price: priceOf(a) as Range | null, note: a.note, ...verdicts[a.id] })),
    { id: 'passenger', label: 'Passenger cover', price: null, priceNote: 'Small, priced per seat', note: 'Personal accident cover for the people in your vehicle. It does not cover you, the owner-driver.', ...verdicts.passenger },
  ]
  const priced = addons.filter((a) => a.verdict === 'take' && a.price)
  const takeSum = priced.reduce((s, a) => s + a.price!.mid, 0)
  const takeLow = priced.reduce((s, a) => s + a.price!.low, 0)
  const takeHigh = priced.reduce((s, a) => s + a.price!.high, 0)

  const tpOnlyPrem = withGst(tp + pa)
  const compMid = withGst(tp + pa + odNet)
  // Third-party is fixed by the government, so only the own-damage part is a range.
  const comp: Range = { low: roundTo(withGst(tp + pa + odNet * M.spread.low), 50), mid: roundTo(compMid, 50), high: roundTo(withGst(tp + pa + odNet * M.spread.high), 50) }
  const withAddons: Range = {
    low: roundTo(withGst(tp + pa + odNet * M.spread.low + takeLow), 50),
    mid: roundTo(withGst(tp + pa + odNet + takeSum), 50),
    high: roundTo(withGst(tp + pa + odNet * M.spread.high + takeHigh), 50),
  }

  const flags: Flag[] = []
  if (i.onLoan && recommended !== 'comprehensive') flags.push({ level: 'critical', text: 'Loan vehicles need comprehensive cover.' })
  if (recommended === 'thirdPartyOnly') flags.push({ level: 'info', text: 'Third-party cover is the law. With third-party only, your own repairs and theft are on you.' })
  flags.push({ level: 'info', text: 'There is no upper limit on what you can owe for injuring or killing someone. That is the real risk of driving uninsured.' })
  if (i.age === '5plus') flags.push({ level: 'info', text: 'Over five years old, the insured value is agreed with the insurer. Cross-check it against used-vehicle listings.' })
  if (i.ncb >= 35 && i.claimSmallDents) flags.push({ level: 'warn', text: 'A small claim can wipe out a large bonus. If repairs cost less than the discount you would lose over the next few years, pay them yourself.' })
  if (i.floodProne) flags.push({ level: 'warn', text: 'After flooding, never restart the engine. It can void the claim.' })
  if (i.streetParking && i.kind === 'car') flags.push({ level: 'info', text: 'Street parking raises theft and dent risk. A fair insured value matters.' })

  const depr = i.age === '5plus' ? null : IDV_DEPRECIATION[i.age]
  const steps: Step[] = [
    { label: 'Insured declared value (IDV)', formula: depr === null ? 'Over five years: agreed with the insurer, near market value' : `${inr(i.value)} ex-showroom × (1 − ${Math.round(depr * 100)}% depreciation for ${ageLabel[i.age].toLowerCase()})`, value: inr(idv) },
    { label: 'Third-party premium', formula: 'Set by the government, the same at every insurer', value: `₹${tp.toLocaleString('en-IN')}` },
    { label: 'Own-damage premium', formula: `IDV × ${(M.odRate[i.kind] * M.odAgeLoad[i.age] * 100).toFixed(2)}% rate, less ${ncb}% no-claim bonus`, value: `₹${Math.round(odNet).toLocaleString('en-IN')}` },
    { label: 'Compulsory owner-driver accident cover (₹15 lakh)', formula: i.hasPA15L ? 'You already hold one, so it can be waived' : 'Included by rule', value: `₹${pa}` },
    { label: 'GST', formula: '18% on third-party, own-damage and add-ons. Individuals cannot claim it back', value: `${Math.round(M.gst * 100)}%` },
    { label: 'Total loss', formula: 'A vehicle is usually a total loss when repairs would exceed 75% of IDV', value: inr(idv * M.totalLossShare) },
  ]

  return {
    idv,
    idvRange: { low: roundTo(idv * 0.9, 1000), mid: idv, high: roundTo(idv * 1.1, 1000) },
    depreciation: depr,
    recommended, why, tp,
    od: { gross: odGross, ncbDiscount, net: odNet },
    addons,
    premium: { thirdPartyOnly: { low: roundTo(tpOnlyPrem, 50), mid: roundTo(tpOnlyPrem, 50), high: roundTo(tpOnlyPrem, 50) }, comprehensive: comp, withAddons },
    ncb,
    compulsoryDeductible: i.kind === 'car' ? M.compulsoryDeductible.car[i.carCc] : 0,
    totalLossAt: idv * M.totalLossShare,
    flags, steps, tpPropertyLimit: M.tpPropertyLimit,
  }
}

/** Should you claim? Compares the repair bill with the no-claim discount you would lose over the next three renewals. */
export function claimOrPay(p: { repairCost: number; deductible: number; odGross: number; ncbPct: number; horizon?: number }) {
  const horizon = p.horizon ?? 3
  let keep = p.ncbPct
  let claimed = 0
  let lost = 0
  for (let y = 1; y <= horizon; y++) {
    keep = nextNcb(keep)
    claimed = claimed === 0 ? 20 : nextNcb(claimed)
    lost += (p.odGross * Math.max(0, keep - claimed)) / 100
  }
  const recovery = Math.max(0, p.repairCost - p.deductible)
  return { recovery, lostDiscount: lost, claim: recovery > lost, margin: recovery - lost }
}
