import { describe, expect, it } from 'vitest'
import { LAKH } from '../src/engine/format'
import { impactsFor } from '../src/engine/impacts'
import { sanitize, type Profile } from '../src/state/profile'

const base: Partial<Profile> = { age: 32, income: 24 * LAKH, dependents: ['spouse'], spouseEarns: false, monthlySpend: 70_000, city: 'metro', hospital: 'standard' }
const P = (o: Partial<Profile>) => sanitize({ ...base, ...o })
const get = (product: 'term' | 'health', p: Profile, id: string) => impactsFor(product, p).find((i) => i.id === id)!

describe('every answer the user gives is acknowledged', () => {
  const loaded = P({ dependents: ['spouse', 'children', 'parents'], kids: 2, youngestChildAge: 4, babyPlanned: true, knownCondition: true, familyHistory: true, selfEmployed: true, smoker: true, heavyCommute: true, owns: ['homeLoan'], loans: 40 * LAKH, goalEducation: true, freeSavings: 10 * LAKH,
    covered: ['ownHealth', 'employerHealth', 'employerLife'], ownCover: 5 * LAKH, employerCover: 5 * LAKH, onLoan: true })
  for (const product of ['term', 'health'] as const) {
    it(`${product}: every active answer has a reason and a label`, () => {
      const rows = impactsFor(product, loaded)
      expect(rows.length).toBeGreaterThan(5)
      for (const r of rows) {
        expect(r.label.length, r.id).toBeGreaterThan(3)
        expect(r.why.length, r.id).toBeGreaterThan(20)
        expect(r.coverLine, r.id).toMatch(/^Cover/)
        expect(r.premiumLine, r.id).toMatch(/^Premium/)
        expect(r.why, r.id).not.toMatch(/NaN|undefined|Infinity/)
        expect(r.todo.join(' '), r.id).not.toMatch(/NaN|undefined|Infinity/)
      }
    })
    it(`${product}: an answer that moves nothing still says why, and what to do`, () => {
      for (const r of impactsFor(product, loaded).filter((x) => !x.moved)) {
        expect(r.why.length, r.id).toBeGreaterThan(20)
        expect(r.todo.length, `${r.id} should say what to do`).toBeGreaterThan(0)
      }
    })
  }
})

describe('the answers people worry about', () => {
  it('health: a planned baby raises the premium, and the reason names the maternity add-on', () => {
    const i = get('health', P({ babyPlanned: true }), 'babyPlanned')
    expect(i.premiumDelta).toBeGreaterThan(0)
    expect(i.why).toMatch(/Maternity cover is an add-on/)
    expect(i.addons.join(' ')).toMatch(/maternity/i)
    expect(i.todo.join(' ')).toMatch(/maternity/i)
  })
  it('health: parents add a plan each: the base cover goes up, and the reason names the plans', () => {
    const i = get('health', P({ dependents: ['spouse', 'parents'], parents: 2, parentAge: 62 }), 'parents')
    expect(i.premiumDelta).toBeGreaterThan(0)
    expect(i.coverLine).toMatch(/up ₹20 lakh/)
    expect(i.why).toMatch(/3 plans/)
    expect(i.todo.join(' ')).toMatch(/separate/i)
  })
  it('health: a known condition loads the premium and explains waiting periods', () => {
    const i = get('health', P({ knownCondition: true }), 'knownCondition')
    expect(i.premiumDelta).toBeGreaterThan(0)
    expect(i.why).toMatch(/waiting|excluded/i)
  })
  it('health: family history is acknowledged with a next step, even though the premium does not move', () => {
    const i = get('health', P({ familyHistory: true }), 'familyHistory')
    expect(i.moved || i.todo.length > 0).toBe(true)
    expect(i.why).toMatch(/critical illness|lump sum/i)
  })
  it('term: parents raise the cover, and the reason names the monthly support', () => {
    const on = get('term', P({ dependents: ['spouse', 'parents'], parents: 2, parentAge: 62, parentSupportMonthly: 30_000 }), 'parents')
    expect(on.coverLine).toMatch(/up/)
    expect(on.why).toMatch(/30,000/)
  })
  it('term: more parent support means more cover', () => {
    const lo = get('term', P({ dependents: ['spouse', 'parents'], parents: 2, parentAge: 62, parentSupportMonthly: 5_000 }), 'parents')
    const hi = get('term', P({ dependents: ['spouse', 'parents'], parents: 2, parentAge: 62, parentSupportMonthly: 60_000 }), 'parents')
    expect(hi.premiumDelta).toBeGreaterThanOrEqual(lo.premiumDelta)
  })
  it('term: family history leads to a critical-illness rider, with its premium counted', () => {
    const i = get('term', P({ familyHistory: true, dependents: ['spouse', 'children'], kids: 1, freeSavings: 60 * LAKH }), 'familyHistory')
    expect(i.moved).toBe(true)
    expect(i.addons.join(' ')).toMatch(/critical illness/i)
  })
  it('term: a smoker pays more, and is told the cover does not change', () => {
    const i = get('term', P({ smoker: true }), 'smoker')
    expect(i.premiumDelta).toBeGreaterThan(0)
    expect(i.coverLine).toMatch(/stays/)
  })
  it('inactive answers are not listed', () => {
    const ids = impactsFor('health', P({})).map((i) => i.id)
    expect(ids).not.toContain('babyPlanned')
    expect(ids).not.toContain('parents')
    expect(ids).not.toContain('knownCondition')
  })
})

describe('hostile profiles never break the explanations', () => {
  it('3000 random profiles: finite, no NaN in any line', () => {
    let seed = 7
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
    const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
    const bool = () => rnd() < 0.5
    const wild = () => pick([0, -5, 1e15, NaN, 12345, 5 * LAKH, 99 * LAKH, 3e9])
    for (let n = 0; n < 3000; n++) {
      const p = sanitize({ age: wild(), income: wild(), monthlySpend: wild(), loans: wild(), freeSavings: wild(), parentSupportMonthly: wild(), ownCover: wild(), employerCover: wild(), savingsForBill: wild(), existingTerm: wild(),
        dependents: ['spouse', 'children', 'parents'].filter(bool) as Profile['dependents'], spouseEarns: bool(), babyPlanned: bool(), knownCondition: bool(), familyHistory: bool(), smoker: bool(), noIncome: bool(), onLoan: bool(), covered: ['ownHealth', 'employerHealth', 'ownTerm', 'employerLife'].filter(bool) as Profile['covered'] })
      for (const product of ['term', 'health'] as const)
        for (const i of impactsFor(product, p)) expect(`${i.why} ${i.coverLine} ${i.premiumLine} ${i.todo.join(' ')}`).not.toMatch(/NaN|undefined|Infinity/)
    }
  })
})
