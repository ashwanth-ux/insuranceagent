import { describe, expect, it } from 'vitest'
import { CRORE, LAKH } from '../src/engine/format'
import { computeHealth, type HealthInput, type HospitalTier } from '../src/engine/health'
import { nothingToBuy, outcomeFor } from '../src/engine/selection'
import { termStanding } from '../src/engine/standing'
import { computeTerm, defaultGoals, type TermInput } from '../src/engine/term'
import { DEFAULTS, sanitize } from '../src/state/profile'

const TIERS: HospitalTier[] = ['local', 'standard', 'top']

const health = (o: Partial<HealthInput>): HealthInput => ({
  age: 35, spouse: true, kids: 2, parents: 0, parentAge: 62, city: 'metro', hospital: 'standard', ownCover: 0, employerCover: 0,
  knownCondition: false, familyHistory: false, babyPlanned: false, savingsForBill: 5 * LAKH, income: 25 * LAKH, ...o,
})

describe('health: planning for pricier hospitals never lowers the cover', () => {
  it('holds across every city, family, savings level, health history and income we offer', () => {
    let combos = 0
    for (const city of ['metro', 'tier2', 'other'] as const)
      for (const age of [24, 35, 50])
        for (const [spouse, kids] of [[false, 0], [true, 0], [true, 1], [true, 2], [true, 3]] as const)
          for (const savingsForBill of [0, 1 * LAKH, 3 * LAKH, 5 * LAKH, 10 * LAKH, 25 * LAKH])
            for (const knownCondition of [false, true])
              for (const familyHistory of [false, true])
                for (const babyPlanned of [false, true])
                  for (const income of [3 * LAKH, 6 * LAKH, 12 * LAKH, 40 * LAKH]) {
                    const r = TIERS.map((hospital) => computeHealth(health({ city, age, spouse, kids, savingsForBill, knownCondition, familyHistory, babyPlanned, income, hospital })))
                    combos++
                    for (let k = 1; k < r.length; k++) {
                      // When the pricier stack would cost more than 8% of income we deliberately recommend the base plan alone, and say so.
                      if (r[k].trimmed || r[k - 1].trimmed) continue
                      expect(r[k].recommendedTotal, `${city} ${age} ${spouse} ${kids} ${savingsForBill} ${knownCondition} ${familyHistory} ${babyPlanned} ${income}: ${TIERS[k]}`).toBeGreaterThanOrEqual(r[k - 1].recommendedTotal)
                    }
                    // A super top-up is only ever a worthwhile size.
                    for (const x of r) if (!x.trimmed && x.superTopUp > 0) expect(x.superTopUp).toBeGreaterThanOrEqual(10 * LAKH)
                  }
    expect(combos).toBeGreaterThan(8000)
  })

  it('a smaller-town couple with savings gets at least as much for good private hospitals as for local ones', () => {
    const local = computeHealth(health({ city: 'other', spouse: true, kids: 0, hospital: 'local' }))
    const good = computeHealth(health({ city: 'other', spouse: true, kids: 0, hospital: 'standard' }))
    expect(local.recommendedTotal).toBe(15 * LAKH)
    expect(good.recommendedTotal).toBeGreaterThanOrEqual(local.recommendedTotal)
  })

  it('a tier-2 family with thin savings is not given less for good private hospitals than for local ones', () => {
    const local = computeHealth(health({ city: 'tier2', savingsForBill: 1 * LAKH, hospital: 'local' }))
    const good = computeHealth(health({ city: 'tier2', savingsForBill: 1 * LAKH, hospital: 'standard' }))
    expect(good.recommendedTotal).toBeGreaterThanOrEqual(local.recommendedTotal)
  })

  it('does not change an answer that was already consistent', () => {
    // A metro family of four on good private hospitals: ₹30L, matching the ₹30L+ floater band the comparison sites quote.
    const r = computeHealth(health({}))
    expect(r.recommendedTotal).toBe(30 * LAKH)
    expect(r.base + r.superTopUp).toBe(r.recommendedTotal)
  })

  it('explains the lift when it happens', () => {
    const good = computeHealth(health({ city: 'other', spouse: true, kids: 0, hospital: 'standard' }))
    expect(good.steps.some((s) => /more modest hospitals/.test(s.formula ?? ''))).toBe(true)
  })
})

describe('term: the smallest policy we suggest is enforced', () => {
  const base: TermInput = {
    age: 30, gender: 'male', smoker: false, income: 8 * LAKH, monthlySpend: 30_000, spouse: 'none', kids: 0, youngestChildAge: 0, dependentParents: false,
    loans: 0, goals: [], freeSavings: 0, existingTerm: 0, employerLife: 0,
  }

  it('someone depends and the need is tiny: suggest the smallest policy, and say why', () => {
    const r = computeTerm({ ...base, spouse: 'earning', monthlySpend: 8_000 })
    expect(r.need.mid).toBeGreaterThan(0)
    expect(r.need.mid).toBeLessThan(25 * LAKH)
    expect(r.recommended).toBe(25 * LAKH)
    expect(r.gapTooSmall).toBe(false)
    expect(r.flags.some((f) => /smallest term policy we suggest/.test(f.text))).toBe(true)
  })

  it('nobody depends and only a small loan is left: no policy, and a plain reason', () => {
    for (const loans of [50_000, 5 * LAKH, 15 * LAKH]) {
      const r = computeTerm({ ...base, loans })
      expect(r.recommended, `loan ${loans}`).toBe(0)
      expect(r.noNeed).toBe(true)
      expect(r.gapTooSmall).toBe(true)
      expect(r.premium.high).toBe(0)
      expect(r.flags.some((f) => /smallest term policy we suggest/.test(f.text))).toBe(true)
    }
  })

  it('nobody depends but the loan is above the smallest policy: still suggests cover, rounded up', () => {
    const r = computeTerm({ ...base, loans: 30 * LAKH })
    expect(r.recommended).toBe(30 * LAKH)
    expect(r.noNeed).toBe(false)
    expect(r.gapTooSmall).toBe(false)
  })

  it('a small leftover gap on top of cover you already hold is called close enough', () => {
    const family: TermInput = { ...base, age: 34, income: 12 * LAKH, monthlySpend: 25_000, spouse: 'homemaker', kids: 2, youngestChildAge: 4, loans: 0 }
    const gross = computeTerm(family).need.mid
    const r = computeTerm({ ...family, existingTerm: gross - 10 * LAKH })
    expect(r.recommended).toBe(0)
    expect(r.gapTooSmall).toBe(true)
    expect(r.standing).toBe('sorted')
    expect(r.flags.some((f) => /existing cover is close enough/.test(f.text))).toBe(true)
  })

  it('a large gap on top of cover you already hold is unchanged', () => {
    const family: TermInput = { ...base, age: 34, income: 12 * LAKH, monthlySpend: 25_000, spouse: 'homemaker', kids: 2, youngestChildAge: 4, goals: defaultGoals(2, 4) }
    const gross = computeTerm(family).need.mid
    expect(gross).toBeGreaterThan(1 * CRORE)
    const r = computeTerm({ ...family, existingTerm: gross - 58 * LAKH })
    expect(r.recommended).toBe(60 * LAKH)
    expect(r.gapTooSmall).toBe(false)
    expect(r.standing).toBe('partly')
  })

  it('reaches the screens: the app says there is nothing to buy and explains why', () => {
    const p = sanitize({ ...DEFAULTS, dependents: [], owns: ['otherLoan'], loans: 50_000, income: 8 * LAKH, noIncome: false })
    expect(nothingToBuy('term', p)).toBe(true)
    expect(outcomeFor('term', p).lines[0].value).toBe('Nothing to add')
    const held = sanitize({ ...DEFAULTS, dependents: ['spouse', 'children'], kids: 2, youngestChildAge: 4, income: 12 * LAKH, monthlySpend: 25_000, covered: ['ownTerm'], existingTerm: 1.4 * CRORE })
    expect(['sorted', 'partly']).toContain(termStanding(held).kind)
  })
})

describe('term: the “under 8× income” warning does not contradict our own answer', () => {
  const young: TermInput = {
    age: 26, gender: 'male', smoker: false, income: 8 * LAKH, monthlySpend: 30_000, spouse: 'none', kids: 0, youngestChildAge: 0, dependentParents: true,
    loans: 50_000, goals: [], freeSavings: 10 * LAKH, existingTerm: 0, employerLife: 0, parentSupportYearly: 15_000 * 12, parentAge: 60,
  }

  it('a young earner supporting parents, with a small loan, is not told to recheck a figure sized on what they send home', () => {
    const r = computeTerm(young)
    expect(r.recommended).toBeGreaterThan(0)
    expect(r.flags.some((f) => /Under 8×/.test(f.text))).toBe(false)
  })

  it('still warns a household with children and a loan whose cover is low against income', () => {
    const r = computeTerm({ ...young, income: 12 * LAKH, spouse: 'homemaker', kids: 1, youngestChildAge: 3, dependentParents: false, parentSupportYearly: 0, monthlySpend: 20_000, loans: 5 * LAKH, freeSavings: 0, age: 35 })
    expect(r.multipleOfIncome).toBeLessThan(8)
    expect(r.flags.some((f) => /Under 8×/.test(f.text))).toBe(true)
  })
})
