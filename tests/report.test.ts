import { describe, expect, it } from 'vitest'
import { LAKH } from '../src/engine/format'
import { funnelFor } from '../src/engine/funnel'
import { nextSteps, REPORT_NOTICE, reportProducts, sectionFor } from '../src/engine/report'
import { sanitize, type Profile } from '../src/state/profile'

const P = (o: Partial<Profile>) => sanitize({ age: 32, income: 24 * LAKH, dependents: ['spouse', 'children'], kids: 1, spouseEarns: false, monthlySpend: 70_000, city: 'metro', hospital: 'standard', ...o })
const FAMILY = P({})

describe('which products the report covers', () => {
  it('a single-product journey reports on that product alone', () => {
    for (const x of ['term', 'health'] as const) expect(reportProducts(true, x)).toEqual([x])
  })
  it('the full guide reports on life and then health, wherever the person finished', () => {
    expect(reportProducts(false, 'term')).toEqual(['term', 'health'])
    expect(reportProducts(false, 'health')).toEqual(['term', 'health'])
  })
})

describe('a section of the report', () => {
  for (const product of ['term', 'health'] as const) {
    it(`${product}: lists exactly the insurers that cleared the bar, insurer first`, () => {
      const s = sectionFor(product, FAMILY)
      const f = funnelFor(product)
      expect(s.nothing).toBe(false)
      expect(s.cleared).toBe(f.survivors.length)
      expect(s.universe).toBe(f.universe)
      expect(s.cards.length).toBeGreaterThanOrEqual(f.survivors.length)
      for (const c of s.cards) {
        expect(c.title.length).toBeGreaterThan(0)
        expect(c.premium).toMatch(/₹/)
        // The insurer is the headline: a plan name never stands in for it.
        if (c.plan) expect(c.title).not.toBe(c.plan)
      }
      const slugs = new Set(s.cards.map((c) => c.slug))
      for (const x of f.survivors) expect(slugs.has(x.slug), x.slug).toBe(true)
    })
    it(`${product}: says what the suggestion is built on, and what happens next`, () => {
      const s = sectionFor(product, FAMILY)
      expect(s.basis.length).toBeGreaterThan(0)
      expect(s.lines.length).toBeGreaterThan(0)
      expect(s.tests.length).toBeGreaterThanOrEqual(2)
      expect(nextSteps(s)).toHaveLength(3)
    })
  }
  it('a person with nothing to buy gets a section with no cards and no cover', () => {
    const s = sectionFor('term', P({ covered: ['ownTerm'], existingTerm: 100 * 100 * LAKH }))
    expect(s.nothing).toBe(true)
    expect(s.cards).toEqual([])
    expect(s.lines).toEqual([])
    expect(s.picked).toEqual([])
  })
  it('the add-on cost is shown only when an add-on has a price', () => {
    const s = sectionFor('term', P({ addons: { 'term.ci': false, 'term.wop': false, 'term.raise': false, 'term.adb': false, 'term.rop': false } }))
    expect(s.withAddons).toBeUndefined()
  })
})

describe('the notice that closes the report', () => {
  it('says it is directional, and not a quote, offer or advice', () => {
    const all = [REPORT_NOTICE.headline, REPORT_NOTICE.short, ...REPORT_NOTICE.points].join(' ').toLowerCase()
    for (const w of ['directional', 'not a quote', 'not financial, tax or legal advice', 'past record']) expect(all).toContain(w)
  })
})
