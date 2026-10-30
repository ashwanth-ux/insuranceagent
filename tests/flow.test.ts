import { describe, expect, it } from 'vitest'
import { scopedFlow } from '../src/flow'
import { prefillFrom } from '../src/prefill'
import { sanitize } from '../src/state/profile'

const q = (s: string) => new URLSearchParams(s)

describe('each product is a complete flow on its own', () => {
  for (const p of ['term', 'health'] as const) {
    it(`${p}: cover, add-ons and insurers are all inside ${p}`, () => {
      const f = scopedFlow(p)
      expect(f.to('cover', p)).toBe(p)
      expect(f.to('addons', p)).toBe(`${p}/addons`)
      expect(f.to('insurers', p)).toBe(`${p}/insurers`)
    })
    it(`${p}: the flow ends on a page of its own, in the guide and on its own`, () => {
      expect(scopedFlow(p).to('done', p)).toBe(`${p}/done`)
    })
  }
})

describe('a host app can hand over what it knows', () => {
  it('nothing passed means no prefill', () => expect(prefillFrom(q(''), q('utm=1'))).toBeNull())
  it('reads a household', () => {
    const patch = prefillFrom(q('age=34&spouse=1&kids=2&parents=2&parentAge=63&city=tier2&hospital=top&income=2400000'))!
    const p = sanitize(patch)
    expect(p.age).toBe(34)
    expect(p.dependents).toEqual(['spouse', 'children', 'parents'])
    expect(p.kids).toBe(2)
    expect(p.parents).toBe(2)
    expect(p.city).toBe('tier2')
    expect(p.hospital).toBe('top')
    expect(p.income).toBe(2400000)
  })
  it('reads loans, a vehicle loan among them', () => {
    const p = sanitize(prefillFrom(q('loans=vehicle,home'))!)
    expect(p.owns.sort()).toEqual(['homeLoan', 'vehicleLoan'])
  })
  it('reads cover already held', () => {
    const p = sanitize(prefillFrom(q('ownHealth=1000000&ownTerm=20000000'))!)
    expect(p.covered).toEqual(['ownHealth', 'ownTerm'])
    expect(p.ownCover).toBe(1000000)
  })
  it('hostile values are clamped or ignored, never trusted', () => {
    const p = sanitize(prefillFrom(q('age=-5&income=1e99&city=moon&hospital=%3Cb%3E&gender=x&kids=999&ownHealth=abc'))!)
    expect(p.age).toBeGreaterThanOrEqual(18)
    expect(p.income).toBeLessThanOrEqual(20 * 1e7)
    expect(p.city).toBe('metro')
    expect(p.kids).toBeLessThanOrEqual(6)
  })
})
