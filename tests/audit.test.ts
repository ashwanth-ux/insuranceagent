import { it } from 'vitest'
import { LAKH, CRORE, inr } from '../src/engine/format'
import { bundleFor, type Bundle } from '../src/engine/bundles'
import { sanitize, type Profile } from '../src/state/profile'

const base = sanitize({ age: 32, gender: 'male', income: 24 * LAKH, dependents: ['spouse', 'children'], spouseEarns: false, kids: 1, youngestChildAge: 2, monthlySpend: 75_000, owns: ['homeLoan', 'car'], loans: 45 * LAKH, freeSavings: 6 * LAKH,
  city: 'metro', hospital: 'standard', parents: 2, parentAge: 62, savingsForBill: 5 * LAKH, vehicleKind: 'car', carCc: '1000to1500', vehicleAge: '2to3', vehicleValue: 10 * LAKH, ncb: 20 })

type Variant = [string, Partial<Profile>]
const V: Record<'term' | 'health' | 'motor', Variant[]> = {
  term: [['age 45', { age: 45 }], ['female', { gender: 'female' }], ['smoker', { smoker: true }], ['income 60L', { income: 60 * LAKH }], ['income 8L', { income: 8 * LAKH }], ['spouse earns', { spouseEarns: true }], ['+parents dependent', { dependents: ['spouse', 'children', 'parents'] }],
    ['3 kids', { kids: 3 }], ['kid age 12', { youngestChildAge: 12 }], ['spend 1.5L', { monthlySpend: 150_000 }], ['loans 1cr', { loans: CRORE }], ['no goals', { goalEducation: false }], ['+marriage goal', { goalMarriage: true }], ['savings 50L', { freeSavings: 50 * LAKH }],
    ['existing term 1cr', { covered: ['ownTerm'], existingTerm: CRORE }], ['years 15', { yearsOverride: 15 }], ['employer life', { covered: ['employerLife'] }], ['heavy commute', { heavyCommute: true }], ['lump sum no', { lumpSum: 'no' }], ['family history', { familyHistory: true }], ['no income (homemaker)', { noIncome: true }]],
  health: [['age 45', { age: 45 }], ['smoker', { smoker: true }], ['female', { gender: 'female' }], ['income 8L', { income: 8 * LAKH }], ['no spouse/kids', { dependents: [] }], ['3 kids', { kids: 3 }], ['+parents (62)', { dependents: ['spouse', 'children', 'parents'] }], ['+parents (75)', { dependents: ['spouse', 'children', 'parents'], parentAge: 75 }],
    ['1 parent', { dependents: ['spouse', 'children', 'parents'], parents: 1 }], ['tier2', { city: 'tier2' }], ['small town', { city: 'other' }], ['top hospitals', { hospital: 'top' }], ['local hospitals', { hospital: 'local' }], ['own cover 10L', { covered: ['ownHealth'], ownCover: 10 * LAKH }], ['own cover 1cr', { covered: ['ownHealth'], ownCover: CRORE }],
    ['employer cover 10L', { covered: ['employerHealth'], employerCover: 10 * LAKH }], ['known condition', { knownCondition: true }], ['family history', { familyHistory: true }], ['baby planned', { babyPlanned: true }], ['savings for bill 25L', { savingsForBill: 25 * LAKH }], ['savings for bill 0', { savingsForBill: 0 }], ['self-employed', { selfEmployed: true }], ['free savings 2cr', { freeSavings: 2 * CRORE }]],
  motor: [['bike', { vehicleKind: 'bike', vehicleValue: 120_000 }], ['cc above 1500', { carCc: 'above1500' }], ['age 5+', { vehicleAge: '5plus', vehicleValue: 300_000 }], ['age <6m', { vehicleAge: 'lt6m' }], ['value 20L', { vehicleValue: 20 * LAKH }], ['on loan', { onLoan: true }], ['can replace', { couldReplace: true }], ['cannot replace', { couldReplace: false }],
    ['flood-prone', { floodProne: true }], ['highway heavy', { highwayHeavy: true }], ['street parking', { streetParking: true }], ['ncb 50', { ncb: 50 }], ['ncb 0', { ncb: 0 }], ['claims small dents (ncb 50)', { ncb: 50, claimSmallDents: true }], ['carries passengers', { carriesPassengers: true }], ['has PA 15L', { hasPA15L: true }], ['age 55 (rider)', { age: 55 }], ['income 60L', { income: 60 * LAKH }]],
}

const diff = (a: Bundle, b: Bundle) => {
  const cover = b.cover - a.cover, prem = b.premium - a.premium
  const add = b.takes.filter((x) => !a.takes.includes(x)), drop = a.takes.filter((x) => !b.takes.includes(x))
  const addC = b.considers.filter((x) => !a.considers.includes(x)), dropC = a.considers.filter((x) => !b.considers.includes(x))
  const flagsNew = b.flags.filter((x) => !a.flags.includes(x)).length
  const tag = b.tags.join() !== a.tags.join()
  return { cover, prem, add, drop, addC, dropC, flagsNew, tag }
}

it('audit: what moves when each answer changes', () => {
  const lines: string[] = []
  for (const product of ['term', 'health', 'motor'] as const) {
    const b0 = bundleFor(product, base)
    lines.push(`\n######## ${product.toUpperCase()}  baseline cover ${inr(b0.cover)} premium ₹${Math.round(b0.premium)} takes [${b0.takes.join('; ')}]`)
    for (const [name, patch] of V[product]) {
      const d = diff(b0, bundleFor(product, sanitize({ ...base, ...patch })))
      const moved = d.cover !== 0 || Math.abs(d.prem) >= 1 || d.add.length || d.drop.length || d.addC.length || d.dropC.length
      const bits = [`cover ${d.cover === 0 ? '·' : (d.cover > 0 ? '+' : '') + inr(d.cover)}`, `prem ${Math.abs(d.prem) < 1 ? '·' : (d.prem > 0 ? '+' : '') + Math.round(d.prem)}`, d.add.length ? `+take ${d.add.join(',')}` : '', d.drop.length ? `-take ${d.drop.join(',')}` : '', d.addC.length ? `+consider ${d.addC.join(',')}` : '', d.flagsNew ? `${d.flagsNew} new flag(s)` : '']
      lines.push(`${moved ? '  ' : '❗'} ${name.padEnd(28)} ${bits.filter(Boolean).join(' | ')}${!moved && !d.flagsNew ? '   ← NOTHING VISIBLE MOVES' : !moved ? '   ← only a flag moves, no number' : ''}`)
    }
  }
  console.log(lines.join('\n'))
})
