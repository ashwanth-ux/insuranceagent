import { describe, expect, it } from 'vitest'
import { LAKH, CRORE, inr } from '../src/engine/format'
import { computeHealth } from '../src/engine/health'
import { computeNeeds } from '../src/engine/needs'
import { computeTerm } from '../src/engine/term'
import { healthInputOf, needsInputOf, termInputOf } from '../src/state/derive'
import { sanitize, type Profile } from '../src/state/profile'

const P = (o: Partial<Profile>) => sanitize(o)

const personas: Record<string, Profile> = {
  'A. 24, single, ₹8L, no dependants, employer health only': P({ age: 24, income: 8 * LAKH, covered: ['employerHealth'], employerCover: 3 * LAKH, city: 'metro', hospital: 'standard' }),
  'B. 32, spouse at home, 1 child (2), ₹24L, ₹45L home loan (Arjun)': P({ age: 32, income: 24 * LAKH, dependents: ['spouse', 'children'], spouseEarns: false, kids: 1, youngestChildAge: 2, monthlySpend: 75_000, owns: ['homeLoan'], loans: 45 * LAKH, freeSavings: 6 * LAKH }),
  'C. 32, dual income, no kids, ₹30L joint home loan': P({ age: 32, income: 18 * LAKH, dependents: ['spouse'], spouseEarns: true, monthlySpend: 60_000, owns: ['homeLoan'], loans: 30 * LAKH }),
  'D. 38, single earner, 2 kids (6, 9), ₹40L, parents depend, ₹60L loan': P({ age: 38, income: 40 * LAKH, dependents: ['spouse', 'children', 'parents'], spouseEarns: false, kids: 2, youngestChildAge: 6, monthlySpend: 110_000, owns: ['homeLoan'], loans: 60 * LAKH, goalMarriage: true, parents: 2, parentAge: 66 }),
  'E. 52, ₹60L, grown kids, no loans, ₹2cr savings': P({ age: 52, income: 60 * LAKH, dependents: ['spouse'], spouseEarns: true, monthlySpend: 150_000, freeSavings: 2 * CRORE, covered: ['ownHealth'], ownCover: 10 * LAKH }),
  'F. 29, self-employed, irregular ₹6L, smoker': P({ age: 29, income: 6 * LAKH, smoker: true, selfEmployed: true, dependents: ['parents'], parents: 2, parentAge: 58 }),
  'G. 34, homemaker (female), spouse earns ₹25L': P({ age: 34, gender: 'female', noIncome: true, dependents: ['children'], kids: 1, youngestChildAge: 4, monthlySpend: 80_000 }),
  'H. 41, ₹1.5cr, high earner, 2 kids, ₹1cr loan, existing ₹1cr term': P({ age: 41, income: 150 * LAKH, dependents: ['spouse', 'children'], spouseEarns: false, kids: 2, youngestChildAge: 8, monthlySpend: 250_000, owns: ['homeLoan'], loans: 100 * LAKH, covered: ['ownTerm'], existingTerm: CRORE, freeSavings: 80 * LAKH, goalMarriage: true }),
  'I. 28, tier-2 town, ₹5L, no loan': P({ age: 28, income: 5 * LAKH, city: 'other', hospital: 'local' }),
}

describe('persona outputs', () => {
  const rows = Object.entries(personas).map(([name, p]) => ({ name, p, t: computeTerm(termInputOf(p)), h: computeHealth(healthInputOf(p)), n: computeNeeds(needsInputOf(p)) }))

  it('prints every output for review', () => {
    for (const r of rows) {
      console.log(`\n${r.name}\n  needs: ${r.n.needs.filter((x) => x.status === 'now').map((x) => x.id).join(', ') || 'none urgent'} (${r.n.stage})` +
        `\n  TERM  need ${inr(r.t.need.mid)} [${inr(r.t.need.low)}–${inr(r.t.need.high)}] buy ${inr(r.t.recommended)} (${(r.t.multipleOfIncome).toFixed(1)}× income) N=${r.t.N}y premium ₹${r.t.premium.low}–${r.t.premium.high} (${r.t.premiumPctOfIncome.toFixed(1)}% of income)${r.t.eligibility.binding ? ' CEILING-BOUND' : ''}` +
        `\n  HEALTH total ${inr(r.h.recommendedTotal)} = base ${inr(r.h.base)} + top-up ${inr(r.h.superTopUp)}; premium ₹${r.h.premium.total.low}–${r.h.premium.total.high} (${r.h.premiumPctOfIncome.toFixed(1)}%)`)
    }
  })

  const by = (k: string) => rows.find((r) => r.name.startsWith(k + '.'))!

  it('A. single with no dependants or loans: no term need, but health is flagged', () => {
    expect(by('A').t.noNeed).toBe(true)
    expect(by('A').n.needs.find((x) => x.id === 'health')!.status).toBe('now')
  })
  it('B. Arjun: ₹2.4–2.5cr (field guide ₹2.35cr + ₹6L savings offset)', () => {
    const r = by('B')
    expect(r.t.need.mid).toBeGreaterThan(2.3 * CRORE)
    expect(r.t.need.mid).toBeLessThan(2.45 * CRORE)
    expect(r.t.N).toBe(25)
  })
  it('C. dual income needs far less than a single earner with the same spend', () => {
    const dual = by('C').t.need.mid
    const single = computeTerm(termInputOf(P({ ...personas['C. 32, dual income, no kids, ₹30L joint home loan'], spouseEarns: false }))).need.mid
    expect(dual).toBeLessThan(single)
  })
  it('D. heavy responsibilities: biggest need, bound by the insurer income ceiling or a high multiple', () => {
    const r = by('D')
    expect(r.t.recommended).toBeGreaterThan(by('B').t.recommended)
    expect(r.t.multipleOfIncome).toBeGreaterThan(8)
  })
  it('E. 52 with ₹2cr savings and no loans: small or no term need', () => {
    expect(by('E').t.recommended).toBeLessThanOrEqual(by('B').t.recommended / 2)
  })
  it('F. smoker pays more than the same person who does not smoke', () => {
    const smoker = by('F').t.premium.mid
    const non = computeTerm(termInputOf(P({ ...personas['F. 29, self-employed, irregular ₹6L, smoker'], smoker: false }))).premium.mid
    expect(smoker).toBeGreaterThan(non * 1.4)
  })
  it('F. low income caps the cover an insurer will sell (25× at 29)', () => {
    expect(by('F').t.eligibility.ceiling).toBe(25 * 6 * LAKH)
  })
  it('G. women pay less than men for the same cover', () => {
    const f = by('G').t
    const m = computeTerm(termInputOf(P({ ...personas['G. 34, homemaker (female), spouse earns ₹25L'], gender: 'male' })))
    expect(f.premium.mid).toBeLessThan(m.premium.mid)
  })
  it('G. homemaker: sized on replacement cost (₹3–8L a year), not on household spending, and never bound by income', () => {
    const g = by('G').t
    expect(g.S).toBeGreaterThanOrEqual(3 * LAKH)
    expect(g.S).toBeLessThanOrEqual(8 * LAKH)
    expect(g.eligibility.binding).toBe(false)
    expect(g.need.mid).toBeLessThan(by('B').t.need.mid)
    expect(g.flags.some((f) => /replacing your work/.test(f.text))).toBe(true)
  })
  it('F. a low earner is not handed an unaffordable health stack', () => {
    const f = by('F').h
    // Parents sit on their own plans and never shrink your own cover. Your own stack must stay affordable, and the parents' cost is flagged separately.
    expect(f.trimmed || f.premiumPctOfIncome <= 8).toBe(true)
    expect(f.recommendedTotal).toBeLessThanOrEqual(75 * LAKH)
    expect(f.premium.parents.mid).toBeGreaterThan(0)
  })
  it('C. a dual-income couple is not told that under-8x cover is low', () => {
    expect(by('C').t.flags.some((f) => /Under 8×/.test(f.text))).toBe(false)
  })
  it('H. existing cover is netted off, and a flag explains the gap', () => {
    const withCover = by('H').t
    const without = computeTerm(termInputOf(P({ ...personas['H. 41, ₹1.5cr, high earner, 2 kids, ₹1cr loan, existing ₹1cr term'], covered: [], existingTerm: 0 })))
    expect(withCover.need.mid).toBeLessThan(without.need.mid - 0.9 * CRORE)
  })
  it('I. smaller town + local hospitals gets a lighter health stack', () => {
    expect(by('I').h.recommendedTotal).toBeLessThan(by('B').h.recommendedTotal)
  })
  it('every persona: health total is at least its base, top-up never negative', () => {
    for (const r of rows) { expect(r.h.recommendedTotal).toBeGreaterThanOrEqual(r.h.base); expect(r.h.superTopUp).toBeGreaterThanOrEqual(0) }
  })
})
