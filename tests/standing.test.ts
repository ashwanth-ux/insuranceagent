import { describe, expect, it } from 'vitest'
import { LAKH, CRORE } from '../src/engine/format'
import { computeHealth } from '../src/engine/health'
import { impactsFor } from '../src/engine/impacts'
import { healthStanding, termStanding } from '../src/engine/standing'
import { healthInputOf } from '../src/state/derive'
import { sanitize, type Profile } from '../src/state/profile'

const P = (o: Partial<Profile>) => sanitize({ age: 32, income: 24 * LAKH, dependents: ['spouse'], spouseEarns: false, monthlySpend: 70_000, city: 'metro', hospital: 'standard', ...o })

describe('credit for what you already hold: health', () => {
  const sorted = P({ covered: ['ownHealth'], ownCover: 80 * LAKH })
  it('80 lakh against a 10 lakh base is sorted, with the surplus stated', () => {
    expect(computeHealth(healthInputOf(P({}))).base).toBe(10 * LAKH)
    const s = healthStanding(sorted)
    expect(s.kind).toBe('sorted')
    expect(s.headline).toMatch(/sorted/i)
    expect(s.sub).toMatch(/70 lakh above/)
    expect(s.sub).toMatch(/above the/)
  })
  it('exactly at the base is sorted too', () => expect(healthStanding(P({ covered: ['ownHealth'], ownCover: 10 * LAKH })).kind).toBe('sorted'))
  it('below the base is partly, and says how far', () => {
    const s = healthStanding(P({ covered: ['ownHealth'], ownCover: 5 * LAKH }))
    expect(s.kind).toBe('partly')
    expect(s.add).toBe(5 * LAKH)
  })
  it('nothing held is fresh', () => expect(healthStanding(P({})).kind).toBe('fresh'))
  it('own cover ticked but zero is fresh', () => expect(healthStanding(P({ covered: ['ownHealth'], ownCover: 0 })).kind).toBe('fresh'))
  it('only employer cover is not credited', () => expect(healthStanding(P({ covered: ['employerHealth'], employerCover: 2 * CRORE })).kind).toBe('fresh'))
  it('someone who is sorted is not offered a super top-up they do not need', () => {
    expect(computeHealth(healthInputOf(sorted)).topUp.recommended).toBe(false)
  })
  it('what is left reacts to the profile: baby, condition', () => {
    const k = healthStanding(P({ covered: ['ownHealth'], ownCover: 80 * LAKH, dependents: ['spouse', 'parents'], parents: 2, parentAge: 62, babyPlanned: true, knownCondition: true })).keep.join(' ')
    expect(k).toMatch(/maternity/i)
    expect(k).toMatch(/disclosed/i)
    expect(k).toMatch(/room-rent/i)
  })
  it('the impact list leads with the credit', () => {
    const first = impactsFor('health', sorted)[0]
    expect(first.id).toBe('ownCover')
    expect(first.win).toBe(true)
    expect(first.coverLine).toMatch(/above the base/)
    expect(first.why).toMatch(/above the ₹10 lakh base/)
  })
})

describe('credit for what you already hold: term', () => {
  const need = P({ dependents: ['spouse', 'children'], kids: 1, youngestChildAge: 3 })
  it('cover above the need is sorted', () => {
    const s = termStanding({ ...need, covered: ['ownTerm'], existingTerm: 20 * CRORE })
    expect(s.kind).toBe('sorted')
    expect(s.sub).toMatch(/above the/)
    expect(s.sub).toMatch(/above the/)
  })
  it('part of the need is partly', () => expect(termStanding({ ...need, covered: ['ownTerm'], existingTerm: 50 * LAKH }).kind).toBe('partly'))
  it('none is fresh', () => expect(termStanding(need).kind).toBe('fresh'))
  it('the impact list credits it first', () => {
    const first = impactsFor('term', { ...need, covered: ['ownTerm'], existingTerm: 20 * CRORE })[0]
    expect(first.win).toBe(true)
    expect(first.coverLine).toMatch(/nothing to add/i)
  })
})

describe('motor credits', () => {
  it('a built-up no-claim bonus is credited', () => {
    const i = impactsFor('motor', P({ owns: ['car'], vehicleKind: 'car', vehicleAge: '1to2', vehicleValue: 12 * LAKH, ncb: 50 })).find((x) => x.id === 'ncb')!
    expect(i.win).toBe(true)
  })
})
