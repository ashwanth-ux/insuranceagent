import { describe, expect, it } from 'vitest'
import { LAKH, CRORE } from '../src/engine/format'
import { computeNeeds } from '../src/engine/needs'
import { computeTerm } from '../src/engine/term'
import { impactsFor } from '../src/engine/impacts'
import { needsInputOf, termInputOf } from '../src/state/derive'
import { sanitize, type Profile } from '../src/state/profile'

const alone = (o: Partial<Profile> = {}) => sanitize({ age: 30, income: 18 * LAKH, dependents: [], monthlySpend: 40_000, ...o })

describe('anyone can add a goal, with or without dependants', () => {
  it('a single person with no loans needs nothing until they add a goal', () => {
    expect(computeTerm(termInputOf(alone())).recommended).toBe(0)
  })
  it('a house goal makes a single person’s cover non-zero, and a bigger goal means more cover', () => {
    const small = computeTerm(termInputOf(alone({ goals: [{ label: 'Buy a house', todayCost: 50 * LAKH, yearsAway: 5 }] })))
    const big = computeTerm(termInputOf(alone({ goals: [{ label: 'Buy a house', todayCost: 2 * CRORE, yearsAway: 5 }] })))
    expect(small.recommended).toBeGreaterThan(0)
    expect(big.recommended).toBeGreaterThan(small.recommended)
    expect(small.parts.goals).toBeGreaterThan(0)
  })
  it('a goal further away needs less cover today than a nearer one (discounted)', () => {
    const near = computeTerm(termInputOf(alone({ goals: [{ label: 'Start a business', todayCost: 50 * LAKH, yearsAway: 2 }] })))
    const far = computeTerm(termInputOf(alone({ goals: [{ label: 'Start a business', todayCost: 50 * LAKH, yearsAway: 15 }] })))
    expect(far.parts.goals).not.toBe(near.parts.goals)
  })
  it('savings are subtracted from the goals', () => {
    const g = [{ label: 'Buy a house', todayCost: 50 * LAKH, yearsAway: 5 }]
    expect(computeTerm(termInputOf(alone({ goals: g, freeSavings: 2 * CRORE }))).recommended).toBe(0)
  })
  it('a homemaker’s own goals still count, while the children’s are left to the earning spouse', () => {
    const base = alone({ noIncome: true, dependents: ['children'], kids: 1, youngestChildAge: 3, goalEducation: true })
    const withOwn = alone({ noIncome: true, dependents: ['children'], kids: 1, youngestChildAge: 3, goalEducation: true, goals: [{ label: 'Start a business', todayCost: 25 * LAKH, yearsAway: 4 }] })
    expect(computeTerm(termInputOf(withOwn)).parts.goals).toBeGreaterThan(computeTerm(termInputOf(base)).parts.goals)
    expect(computeTerm(termInputOf(base)).parts.goals).toBe(0)
  })
  it('a goal makes term relevant in the needs list', () => {
    expect(computeNeeds(needsInputOf(alone())).termRelevant).toBe(false)
    expect(computeNeeds(needsInputOf(alone({ goals: [{ label: 'Buy a house', todayCost: 50 * LAKH, yearsAway: 5 }] }))).termRelevant).toBe(true)
  })
  it('the impact list explains the goal', () => {
    const i = impactsFor('term', alone({ goals: [{ label: 'Buy a house', todayCost: 50 * LAKH, yearsAway: 5 }] })).find((x) => x.id === 'goals')!
    expect(i.moved).toBe(true)
    expect(i.coverLine).toMatch(/up/)
  })
  it('goals are sanitised: at most five, clamped, labels cleaned', () => {
    const p = sanitize({ goals: Array.from({ length: 9 }, () => ({ label: '<b>House</b> 🔥', todayCost: 1e15, yearsAway: -5 })) })
    expect(p.goals).toHaveLength(5)
    expect(p.goals[0].label).not.toMatch(/[<>🔥]/)
    expect(p.goals[0].todayCost).toBeLessThanOrEqual(10 * CRORE)
    expect(p.goals[0].yearsAway).toBeGreaterThanOrEqual(0)
    expect(sanitize({ goals: 'x' as unknown as Profile['goals'] }).goals).toEqual([])
    expect(sanitize({ goals: [null, 5, { label: 7 }] as unknown as Profile['goals'] }).goals[0].label).toBe('A goal')
  })
})
