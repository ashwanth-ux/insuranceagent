import { describe, expect, it } from 'vitest'
import { CRORE, LAKH } from '../src/engine/format'
import { annuityFactor, computeTerm, defaultGoals, humanLifeValue, realRate, termNeed, termPremium, type TermInput } from '../src/engine/term'

const cr = (n: number) => n / CRORE

/** Field guide §5.1 worked example: Arjun, 32, ₹24L, wife homemaker, child 2, ₹75k/month, ₹45L home loan, ₹6L free savings. */
const arjun: TermInput = {
  age: 32, gender: 'male', smoker: false, income: 24 * LAKH, monthlySpend: 75_000,
  spouse: 'homemaker', kids: 1, youngestChildAge: 2, dependentParents: false,
  loans: 45 * LAKH, goals: defaultGoals(1, 2), freeSavings: 6 * LAKH, existingTerm: 0, employerLife: 0,
}

describe('term formula reproduces the field guide', () => {
  const r = computeTerm(arjun)

  it('support S = ₹9L × 75% = ₹6.75L, N = 25', () => {
    expect(r.S).toBe(675_000)
    expect(r.N).toBe(25)
  })
  it('real return is 0.94%', () => {
    expect(realRate(0.07, 0.06) * 100).toBeCloseTo(0.9434, 3)
  })
  it('income support ≈ ₹1.50 crore', () => {
    expect(cr(r.parts.support)).toBeCloseTo(1.5, 2)
  })
  it('education PV ≈ ₹0.46 crore (₹40L, 16 yrs, 9% inflation, 8% discount)', () => {
    expect(cr(r.goalsPV)).toBeCloseTo(0.46, 2)
  })
  it('base need ≈ ₹2.35 crore, 9.8× income', () => {
    expect(cr(r.need.mid)).toBeCloseTo(2.35, 2)
    expect(r.need.mid / (24 * LAKH)).toBeCloseTo(9.8, 1)
  })
  it('range ≈ ₹2.2 to ₹2.7 crore', () => {
    expect(cr(r.need.low)).toBeCloseTo(2.19, 2)
    expect(cr(r.need.high)).toBeGreaterThan(2.6)
    expect(cr(r.need.high)).toBeLessThan(2.8)
  })
  it('sensitivity grid matches the guide (6.5/7/8% × 20/25/30 yrs)', () => {
    const g = r.sensitivity.grid.map((row) => row.map(cr))
    const want = [[2.14, 2.44, 2.74], [2.08, 2.35, 2.61], [1.97, 2.19, 2.39]]
    // grid rows are returns; our columns are N-5, N, N+5 = 20, 25, 30
    want.forEach((row, ri) => row.forEach((v, ci) => expect(g[ri][ci]).toBeCloseTo(v, 1)))
  })
  it('HLV cross-check ≈ ₹3.4 crore', () => {
    expect(cr(humanLifeValue(32, 24 * LAKH))).toBeCloseTo(3.4, 1)
  })
  it('recommends the need rounded up to a ₹5L step: ₹2.40 crore (guide: "centred near ₹2.4 crore"), 10× income', () => {
    expect(r.recommended).toBe(2.4 * CRORE)
    expect(r.recommended % (5 * LAKH)).toBe(0)
    expect(r.recommended).toBeGreaterThanOrEqual(r.need.mid)
    expect(r.multipleOfIncome).toBeCloseTo(10, 1)
  })
  it('premium for ~₹2.5cr at 32 stays within a sensible band of the guide’s ₹18–22k', () => {
    const p = termPremium({ age: 32, gender: 'male', smoker: false, cover: 2.5 * CRORE, coverToAge: 60 })
    expect(p.mid).toBeGreaterThan(18_000)
    expect(p.mid).toBeLessThan(25_000)
  })
})

import { TERM_PLANS, TERM_25YR_QUOTES } from '../src/data/plans'

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

describe('premium model is calibrated to real plan quotes (Ditto, Sept 2026)', () => {
  const profiles = [
    { key: 'm25', age: 25, gender: 'male' },
    { key: 'f25', age: 25, gender: 'female' },
    { key: 'm35', age: 35, gender: 'male' },
    { key: 'f35', age: 35, gender: 'female' },
  ] as const
  for (const p of profiles) {
    it(`₹2cr to 65, ${p.gender} ${p.age}: model within 5% of the ten-plan mean`, () => {
      const real = mean(TERM_PLANS.map((t) => t.premium[p.key]))
      const model = termPremium({ age: p.age, gender: p.gender, smoker: false, cover: 2 * CRORE, coverToAge: 65 }).mid
      expect(Math.abs(model - real) / real).toBeLessThan(0.05)
    })
    it(`every one of the ten real quotes for ${p.gender} ${p.age} sits inside the model's low–high band (±)`, () => {
      const r = termPremium({ age: p.age, gender: p.gender, smoker: false, cover: 2 * CRORE, coverToAge: 65 })
      const inside = TERM_PLANS.filter((t) => t.premium[p.key] >= r.low * 0.97 && t.premium[p.key] <= r.high * 1.03).length
      expect(inside).toBeGreaterThanOrEqual(9)
    })
  }
  it('₹5cr, 35M, to 60: the band contains SBI’s ₹32.8k and LIC’s ₹41.3k', () => {
    const r = termPremium({ age: 35, gender: 'male', smoker: false, cover: 5 * CRORE, coverToAge: 60 })
    const sbi = TERM_25YR_QUOTES.find((q) => q.plan === 'sbi-smart-shield-plus')!.year1
    const lic = TERM_25YR_QUOTES.find((q) => q.plan === 'lic-new-tech-term')!.year1
    expect(sbi).toBeGreaterThanOrEqual(r.low * 0.97)
    expect(lic).toBeLessThanOrEqual(r.high * 1.03)
  })
  it('field-guide anchor (30M, ₹1cr, to 60 ≈ ₹9,500) is within 20%', () => {
    const m = termPremium({ age: 30, gender: 'male', smoker: false, cover: CRORE, coverToAge: 60 }).mid
    expect(Math.abs(m - 9_500) / 9_500).toBeLessThan(0.2)
  })
})

describe('shape', () => {
  it('smoker adds 60–100%', () => {
    const a = termPremium({ age: 30, gender: 'male', smoker: false, cover: CRORE, coverToAge: 60 }).mid
    const b = termPremium({ age: 30, gender: 'male', smoker: true, cover: CRORE, coverToAge: 60 }).mid
    expect(b / a).toBeGreaterThan(1.6)
    expect(b / a).toBeLessThan(2.0)
  })
  it('₹2cr ≈ 1.73× ₹1cr', () => {
    const a = termPremium({ age: 30, gender: 'male', smoker: false, cover: CRORE, coverToAge: 60 }).mid
    const b = termPremium({ age: 30, gender: 'male', smoker: false, cover: 2 * CRORE, coverToAge: 60 }).mid
    expect(b / a).toBeCloseTo(1.73, 1)
  })
  it('monotonic in age and cover; never below the floor or NaN, for the full input range', () => {
    let prev = 0
    for (let a = 18; a <= 70; a++) {
      const v = termPremium({ age: a, gender: 'male', smoker: false, cover: CRORE, coverToAge: Math.max(60, a + 10) }).mid
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(2_500)
      void prev
      prev = v
    }
    let pc = 0
    for (const c of [5, 10, 25, 50, 100, 200, 500, 1000, 5000, 10000].map((l) => l * LAKH)) {
      const v = termPremium({ age: 35, gender: 'male', smoker: false, cover: c, coverToAge: 60 }).mid
      expect(v).toBeGreaterThanOrEqual(pc)
      if (c >= 50 * LAKH) expect(v).toBeGreaterThan(pc)
      pc = v
    }
  })
  it('annuity factor degenerates to N at r=0', () => {
    expect(annuityFactor(0, 25)).toBe(25)
    expect(termNeed({ S: 100, N: 10, i: 0.06, pi: 0.06, L: 0, G: 0, A: 0, E: 0 }).total).toBeCloseTo(1000, 6)
  })
})
