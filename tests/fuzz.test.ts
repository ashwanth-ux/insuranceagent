import { describe, expect, it } from 'vitest'
import { searchFaq } from '../src/engine/faq'
import { addonItems, outcomeFor } from '../src/engine/selection'
import { computeHealth } from '../src/engine/health'
import { computeNeeds } from '../src/engine/needs'
import { computeTerm } from '../src/engine/term'
import { effectiveSpend, healthInputOf, kidsOf, monthlyEmi, needsInputOf, termInputOf } from '../src/state/derive'
import { sanitize, type Profile } from '../src/state/profile'

// Deterministic PRNG so failures reproduce.
let seed = 123456789
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]
const HOSTILE: unknown[] = [NaN, Infinity, -Infinity, 1e308, -1e308, 0, -1, 1, 0.5, '', 'abc', null, undefined, {}, [], true, false, '1e999', 5e-324, 2 ** 53, -(2 ** 53), '₹5 lakh', [1, 2], { a: 1 }]
const maybe = (v: unknown) => (rnd() < 0.35 ? pick(HOSTILE) : v)
const range = (lo: number, hi: number) => lo + rnd() * (hi - lo)
const logr = (lo: number, hi: number) => Math.exp(range(Math.log(lo), Math.log(hi)))

function randomRaw(): Record<string, unknown> {
  return {
    age: maybe(Math.round(range(10, 100))), gender: maybe(pick(['male', 'female', 'other', 'x'])), smoker: maybe(rnd() < 0.5),
    dependents: maybe([pick(['spouse', 'children', 'parents', 'pets'])]), income: maybe(logr(1e4, 5e9)), noIncome: maybe(rnd() < 0.3), owns: maybe([pick(['homeLoan', 'vehicleLoan', 'otherLoan'])]), covered: maybe([pick(['ownHealth', 'employerHealth', 'ownTerm', 'employerLife', 'savingsPlan'])]),
    spouseEarns: maybe(rnd() < 0.5), kids: maybe(Math.round(range(-2, 12))), youngestChildAge: maybe(Math.round(range(-3, 40))), monthlySpend: maybe(rnd() < 0.5 ? null : logr(100, 1e8)), loans: maybe(rnd() < 0.5 ? null : logr(1, 1e10)),
    goalEducation: maybe(rnd() < 0.5), goalMarriage: maybe(rnd() < 0.5), freeSavings: maybe(logr(1, 1e10)), existingTerm: maybe(logr(1, 1e11)), yearsOverride: maybe(rnd() < 0.5 ? null : Math.round(range(-5, 80))),
    city: maybe(pick(['metro', 'tier2', 'other', 'moon'])), hospital: maybe(pick(['top', 'standard', 'local', 'x'])), parents: maybe(pick([0, 1, 2, 3, -1])), parentAge: maybe(Math.round(range(0, 120))), ownCover: maybe(logr(1, 1e10)), employerCover: maybe(logr(1, 1e10)),
    knownCondition: maybe(rnd() < 0.5), familyHistory: maybe(rnd() < 0.5), babyPlanned: maybe(rnd() < 0.5), savingsForBill: maybe(logr(1, 1e10)),
    onLoan: maybe(rnd() < 0.5),
    heavyCommute: maybe(rnd() < 0.5), selfEmployed: maybe(rnd() < 0.5), lumpSum: maybe(pick(['yes', 'no', 'unsure', 'q'])), priority: maybe(pick(['certainty', 'strength', 'service', 'z'])), revealed: maybe({ need: true, 'amount.term': rnd() < 0.5 }),
  }
}

const bad = (s: string) => /NaN|undefined|Infinity|\[object/.test(s)
const finite = (o: unknown, path = ''): string[] => {
  if (typeof o === 'number') return Number.isFinite(o) ? [] : [`${path}=${o}`]
  if (Array.isArray(o)) return o.flatMap((x, i) => finite(x, `${path}[${i}]`))
  if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => finite(v, `${path}.${k}`))
  return []
}

describe('fuzz: 20,000 hostile profiles through every calculation', () => {
  it('never throws, never non-finite, never negative money, never prints NaN', () => {
    const fails: string[] = []
    for (let n = 0; n < 20000; n++) {
      const raw = randomRaw()
      let p: Profile
      try { p = sanitize(raw as Partial<Profile>) } catch (e) { fails.push(`sanitize threw ${String(e)} for ${JSON.stringify(raw).slice(0, 200)}`); continue }
      try {
        const t = computeTerm(termInputOf(p)), h = computeHealth(healthInputOf(p)), nd = computeNeeds(needsInputOf(p))
        const ta = addonItems('term', p), ha = addonItems('health', p)
        const oc = { t: outcomeFor('term', p), h: outcomeFor('health', p) }
        const all = { t, h, nd, ta, ha, oc }
        const nf = finite(all)
        if (nf.length) fails.push(`non-finite ${nf.slice(0, 3).join(', ')}`)
        const text = JSON.stringify(all)
        if (bad(text)) fails.push(`bad text in output: ${text.match(/.{20}(NaN|undefined|Infinity|\[object).{20}/)?.[0]}`)
        for (const [k, v] of Object.entries({ rec: t.recommended, need: t.need.mid, tprem: t.premium.mid, htot: h.recommendedTotal, hprem: h.premium.total.mid }))
          if (v < 0) fails.push(`negative ${k}=${v}`)
        if (t.need.low > t.need.mid + 1 || t.need.mid > t.need.high + 1) fails.push(`term range out of order ${t.need.low}/${t.need.mid}/${t.need.high}`)
        if (t.premium.low > t.premium.high) fails.push('term premium range inverted')
        if (h.premium.total.low > h.premium.total.high) fails.push('health premium range inverted')
        for (const o of Object.values(oc)) if (o.total.low > o.total.high || o.total.low < 0) fails.push('outcome premium range inverted or negative')
        if (t.recommended > t.eligibility.additionalAllowed + 1) fails.push(`recommended above insurer ceiling`)
        if (t.recommended % 500000 !== 0 && t.recommended !== 0) fails.push(`recommended not a ₹5L step: ${t.recommended}`)
      } catch (e) { fails.push(`engine threw ${String(e)} for ${JSON.stringify(raw).slice(0, 160)}`) }
      if (fails.length > 20) break
    }
    if (fails.length) console.log(fails.slice(0, 20).join('\n'))
    expect(fails).toEqual([])
  }, 120_000)

  it('FAQ search never throws on 5,000 random strings built from insurance words and noise', () => {
    const words = ['term', 'health', 'cover', 'premium', 'lakh', 'crore', '45', '₹', 'hdfc', 'lic', 'vs', 'best', 'how much', 'what is', '?', '!', ',', 'wife', 'kid', 'loan', 'earn', 'smoke', '000', '1e9', '-5', 'zero dep', 'claim', 'reject', 'hide', 'hindi', 'kitna', '😀', '<b>', '\n']
    for (let i = 0; i < 5000; i++) {
      const q = Array.from({ length: Math.floor(range(1, 18)) }, () => pick(words)).join(rnd() < 0.5 ? ' ' : '')
      const r = searchFaq(q)
      expect(Array.isArray(r)).toBe(true)
      expect(r.length).toBeLessThanOrEqual(30)
    }
  })
})
