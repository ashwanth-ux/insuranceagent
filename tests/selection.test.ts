import { describe, expect, it } from 'vitest'
import { LAKH } from '../src/engine/format'
import { addonItems, addonKey, outcomeFor } from '../src/engine/selection'
import { bundleFor } from '../src/engine/bundles'
import { sanitize, type Profile } from '../src/state/profile'

const P = (o: Partial<Profile>) => sanitize({ age: 32, income: 24 * LAKH, dependents: ['spouse', 'children'], kids: 1, spouseEarns: false, monthlySpend: 70_000, city: 'metro', hospital: 'standard', owns: ['car'], vehicleKind: 'car', vehicleAge: '1to2', vehicleValue: 12 * LAKH, ...o })

describe('add-ons are chosen, and the outcome follows the choice', () => {
  for (const product of ['term', 'health', 'motor'] as const) {
    it(`${product}: what we suggest starts switched on, and nothing else does`, () => {
      for (const i of addonItems(product, P({}))) expect(i.on, `${product}.${i.id}`).toBe(i.verdict === 'take' && i.selectable)
    })
    it(`${product}: switching an add-on off removes it from the outcome; the premium never rises when something is switched off`, () => {
      const p = P({})
      const on = addonItems(product, p).filter((i) => i.on)
      const base = outcomeFor(product, p)
      for (const i of on) {
        const off = outcomeFor(product, { ...p, addons: { [addonKey(product, i.id)]: false } })
        expect(off.picked).not.toContain(i.label)
        expect(off.total.high).toBeLessThanOrEqual(base.total.high)
        expect(off.total.low).toBeLessThanOrEqual(base.total.low)
      }
    })
    it(`${product}: switching a priced add-on on raises the premium and shows in the picked list`, () => {
      const p = P({})
      const priced = addonItems(product, p).find((i) => !i.on && i.selectable && i.cost && i.cost.high > 0)
      if (!priced) return
      const before = outcomeFor(product, p), after = outcomeFor(product, { ...p, addons: { [addonKey(product, priced.id)]: true } })
      expect(after.total.high).toBeGreaterThan(before.total.high)
      expect(after.picked).toContain(priced.label)
    })
  }

  it('the super top-up is offered once, as an add-on, and is not part of the base plans', () => {
    const p = P({})
    expect(addonItems('health', p).filter((i) => /top-up/i.test(i.label))).toHaveLength(1)
    const stu = addonItems('health', p).find((i) => i.id === 'stu')!
    expect(stu.verdict).toBe('take')
    expect(stu.cover!.amount).toBeGreaterThanOrEqual(10 * LAKH)
    const withIt = outcomeFor('health', p), without = outcomeFor('health', { ...p, addons: { 'health.stu': false } })
    expect(withIt.total.mid).toBeGreaterThan(without.total.mid)
    expect(withIt.lines[0].value).not.toBe(without.lines[0].value)
  })
  it('a plan for each parent is a base plan, not an add-on', () => {
    expect(addonItems('health', P({ dependents: ['spouse', 'parents'], parents: 2 })).some((i) => /senior|parent/i.test(i.label))).toBe(false)
  })
  it('selecting the family history raises a critical illness suggestion for term and switches it on', () => {
    const ci = addonItems('term', P({ familyHistory: true, freeSavings: 60 * LAKH })).find((i) => i.id === 'ci')!
    expect(ci.verdict).toBe('take')
    expect(ci.on).toBe(true)
    expect(ci.cover!.amount).toBeGreaterThan(10 * LAKH)
  })
  it('a plan we advise against buying cannot be switched on', () => {
    const s = addonItems('term', P({})).find((i) => i.id === 'savings')!
    expect(s.selectable).toBe(false)
    expect(outcomeFor('term', { ...P({}), addons: { 'term.savings': true } }).picked).not.toContain(s.label)
  })
  it('the base plus the add-ons equals the total', () => {
    for (const product of ['term', 'health', 'motor'] as const) {
      const o = outcomeFor(product, P({ dependents: ['spouse', 'children', 'parents'], parents: 2, floodProne: true, carriesPassengers: true }))
      expect(Math.abs(o.base.mid + o.extras.mid - o.total.mid)).toBeLessThanOrEqual(1)
    }
  })
  it('motor: add-ons only apply to comprehensive cover', () => {
    const old = P({ owns: ['bike'], vehicleKind: 'bike', vehicleAge: '5plus', vehicleValue: 35_000, couldReplace: true })
    const items = addonItems('motor', old)
    expect(items.filter((i) => i.selectable).every((i) => i.id === 'passenger')).toBe(true)
    expect(outcomeFor('motor', old).extras.high).toBe(0)
  })
  it('selections never leak between products', () => {
    const p = { ...P({}), addons: { 'term.wop': false } }
    expect(addonItems('health', p).filter((i) => i.on).length).toBe(addonItems('health', P({})).filter((i) => i.on).length)
  })
})

describe('step 2 talks about base plans only', () => {
  it('health: the headline is the family plan plus a plan for each parent, and parents move it', () => {
    const solo = bundleFor('health', P({ dependents: ['spouse'] })).cover
    const withParents = bundleFor('health', P({ dependents: ['spouse', 'parents'], parents: 2, parentAge: 62 })).cover
    expect(withParents).toBe(solo + 20 * LAKH)
  })
  it('health: moving from good to top private hospitals moves the base cover', () => {
    expect(bundleFor('health', P({ hospital: 'top' })).cover).toBeGreaterThan(bundleFor('health', P({ hospital: 'standard' })).cover)
  })
  it('the add-ons we suggest are named on the bundle, for the summary strip', () => {
    expect(bundleFor('health', P({})).takes).toContain('Super top-up')
    expect(bundleFor('motor', P({ floodProne: true })).takes.join(' ')).toMatch(/engine/i)
    expect(bundleFor('term', P({ familyHistory: true, freeSavings: 60 * LAKH })).takes.join(' ')).toMatch(/critical illness/i)
  })
})
