import { describe, expect, it } from 'vitest'
import { LAKH, CRORE } from '../src/engine/format'
import { assumptionsFor } from '../src/engine/assumptions'
import { computeHealth } from '../src/engine/health'
import { healthPlansView, healthStanding } from '../src/engine/standing'
import { healthInputOf } from '../src/state/derive'
import { sanitize, type Profile } from '../src/state/profile'

const P = (o: Partial<Profile>) => sanitize({ age: 32, income: 24 * LAKH, dependents: ['spouse'], spouseEarns: false, monthlySpend: 70_000, city: 'metro', hospital: 'standard', ...o })

describe('quick flow: the answer comes from step 1 alone, and says what it assumed', () => {
  const get = (xs: { key: string; value: string; suggested: boolean }[], k: string) => xs.find((x) => x.key === k)!
  it('a spouse and a child give a term answer with every filled-in guess marked Suggested', () => {
    const a = assumptionsFor('term', sanitize({ age: 30, dependents: ['spouse', 'children'], income: 18 * LAKH }))
    expect(get(a, 'Family').suggested).toBe(true)
    expect(get(a, 'Household spending').suggested).toBe(true)
    expect(get(a, 'Years of support').suggested).toBe(true)
    expect(get(a, 'Family').value).toMatch(/1 child, youngest/)
  })
  it('what the user has changed is no longer marked Suggested', () => {
    const a = assumptionsFor('term', sanitize({ age: 30, dependents: ['spouse', 'children'], income: 18 * LAKH, monthlySpend: 60_000, yearsOverride: 22, touched: { youngestChildAge: true, spouseEarns: true } }))
    expect(get(a, 'Family').suggested).toBe(false)
    expect(get(a, 'Household spending').suggested).toBe(false)
    expect(get(a, 'Years of support').suggested).toBe(false)
  })
  it('every product lists assumptions, none empty or NaN', () => {
    for (const product of ['term', 'health'] as const) {
      const a = assumptionsFor(product, P({ dependents: ['spouse', 'children', 'parents'], kids: 2, babyPlanned: true }))
      expect(a.length).toBeGreaterThan(3)
      for (const x of a) expect(`${x.key} ${x.value}`).not.toMatch(/NaN|undefined|Infinity|\[object/)
    }
  })
  it('the summary stays short: no more than nine lines for any product', () => {
    for (const product of ['term', 'health'] as const) expect(assumptionsFor(product, P({ dependents: ['spouse', 'children', 'parents'], kids: 2, babyPlanned: true, covered: ['ownTerm', 'ownHealth'], existingTerm: CRORE, ownCover: 10 * LAKH })).length).toBeLessThanOrEqual(9)
  })
  it('touched is sanitised', () => {
    const p = sanitize({ touched: { age: true, 'bad key!': true, x: 'nope' as unknown as boolean } })
    expect(p.touched).toEqual({ age: true })
  })
})

describe('health: base first, parents visible', () => {
  const family = P({ dependents: ['spouse', 'children', 'parents'], kids: 2, parents: 2, parentAge: 62 })
  it('plans are listed base first, then the top-up, then the parents, each with its own cover', () => {
    const plans = healthPlansView(family)
    expect(plans.map((x) => x.id)).toEqual(['base', 'parent', 'parent'])
    expect(plans.map((x) => x.cover)).toEqual([15 * LAKH, 10 * LAKH, 10 * LAKH])
    expect(plans[2].group).toBe('parents')
    expect(computeHealth(healthInputOf(family)).basePlans.totalCover).toBe(35 * LAKH)
  })
  it('one parent gets one plan, two parents get two', () => {
    expect(healthPlansView(P({ dependents: ['parents'], parents: 1, parentAge: 62 })).filter((x) => x.id === 'parent')).toHaveLength(1)
    expect(healthPlansView(P({ dependents: ['parents'], parents: 2, parentAge: 62 })).filter((x) => x.id === 'parent')).toHaveLength(2)
  })
  it('if you hold a plan below a clean base, the list starts with it and keeps the parents’ plans', () => {
    const plans = healthPlansView({ ...family, covered: ['ownHealth'], ownCover: 10 * LAKH })
    expect(plans[0].role).toBe('have')
    expect(plans.filter((x) => x.id === 'parent')).toHaveLength(2)
  })
  it('if you are sorted, only what is still to arrange is listed', () => {
    const plans = healthPlansView({ ...family, covered: ['ownHealth'], ownCover: 30 * LAKH })
    expect(plans.map((x) => x.id)).toEqual(['parent', 'parent'])
    expect(healthStanding({ ...family, covered: ['ownHealth'], ownCover: 30 * LAKH }).kind).toBe('sorted')
  })
  it('the premium never exceeds what the plans add up to', () => {
    const r = computeHealth(healthInputOf(family))
    const sum = r.plans.reduce((s, x) => s + x.premium.mid, 0)
    expect(Math.abs(sum - r.basePlans.premium.mid)).toBeLessThan(300)
  })
})

describe('no one is told to buy more than ₹50 lakh of health cover', () => {
  it('across hostile combinations', () => {
    for (const city of ['metro', 'tier2', 'other'] as const) for (const hospital of ['top', 'standard', 'local'] as const) for (const flag of [true, false]) {
      const r = computeHealth(healthInputOf(P({ city, hospital, familyHistory: flag, knownCondition: flag, dependents: ['spouse', 'children', 'parents'], kids: 6, savingsForBill: 0, income: 40 * CRORE })))
      expect(r.recommendedTotal).toBeLessThanOrEqual(50 * LAKH)
      expect(r.base).toBeGreaterThanOrEqual(5 * LAKH)
    }
  })
})
