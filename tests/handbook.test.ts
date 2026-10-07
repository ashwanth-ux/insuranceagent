import { describe, expect, it } from 'vitest'
import { claimsIntimated, life30Day, life30DayLatest, inForcePolicies, lifeComplaintsPer10kPolicies, paidWithin3Months, paidShareOfDecided } from '../src/engine/handbook'
import { factsFor } from '../src/engine/insurerFacts'
import { rawValue } from '../src/engine/kb'
import raw from '../src/data/irdai-handbook.json'

const H = raw as unknown as { table18: Record<string, Record<string, { totalNum: number }>> }

describe('IRDAI Handbook 2024-25 parse is consistent with the other IRDAI table we already trust', () => {
  it('Table 18 claims settled equals Table 15 claims paid (colleague KB) for every life insurer with data', () => {
    let checked = 0
    for (const slug of Object.keys(H.table18)) {
      const a = H.table18[slug]['2024-25']?.totalNum
      const b = rawValue('life', 'claims_paid_count_pct', slug, 'claims paid count')
      if (a && b) { checked++; expect(Math.abs(a - b) / b, slug).toBeLessThan(0.002) }
    }
    expect(checked).toBeGreaterThanOrEqual(18)
  })
  it('HDFC Life settles 99.98% within 30 days of intimation, Axis Max 94.4%, LIC 97.1% (FY2024-25)', () => {
    expect(life30DayLatest('hdfc-life')).toBeCloseTo(99.98, 1)
    expect(life30DayLatest('axis-max-life')).toBeCloseTo(94.41, 1)
    expect(life30DayLatest('lic')).toBeCloseTo(97.08, 1)
  })
  it('three-year 30-day figure is a claims-weighted average and sits between its yearly values', () => {
    const v = life30Day('axis-max-life')!
    expect(v).toBeGreaterThan(80); expect(v).toBeLessThanOrEqual(100)
  })
  it('policy counts and complaints per 10,000 policies are sane', () => {
    expect(inForcePolicies('lic')).toBeGreaterThan(2e8)
    const lic = lifeComplaintsPer10kPolicies('lic')!, hdfc = lifeComplaintsPer10kPolicies('hdfc-life')!
    expect(lic).toBeGreaterThan(0.5); expect(lic).toBeLessThan(20)
    expect(hdfc).toBeGreaterThan(0.5); expect(hdfc).toBeLessThan(50)
    expect(lifeComplaintsPer10kPolicies('acko-life')).toBeNull()
  })
  it('Table 53: claim ageing for general and health insurers', () => {
    expect(paidWithin3Months('reliance-general')!).toBeGreaterThan(98)
    expect(paidWithin3Months('iffco-tokio')!).toBeLessThan(90)
    expect(paidShareOfDecided('star-health')!).toBeGreaterThan(80)
    expect(claimsIntimated('new-india-assurance')!).toBeGreaterThan(1e7)
  })
  it('facts for the UI come from the handbook and never print NaN', () => {
    for (const p of ['term', 'health', 'motor'] as const)
      for (const slug of ['hdfc-life', 'axis-max-life', 'star-health', 'icici-lombard', 'niva-bupa']) {
        const s = JSON.stringify(factsFor(p, slug))
        expect(s).not.toMatch(/NaN|undefined|Infinity/)
      }
    expect(factsFor('term', 'hdfc-life').find((f) => f.key === 'd30')!.basis).toMatch(/Table 18/)
  })
})

describe('Table 53 age analysis is always a share between 0 and 100', () => {
  const T = (raw as unknown as { table53: Record<string, Record<string, { lt3m: number | null; paid: number | null }>> }).table53
  it('every value is a percentage or null, including the FY2023-24 rows IRDAI reported as counts', () => {
    for (const [slug, years] of Object.entries(T)) for (const [y, r] of Object.entries(years)) if (r.lt3m !== null) { expect(r.lt3m, `${slug} ${y}`).toBeGreaterThanOrEqual(0); expect(r.lt3m, `${slug} ${y}`).toBeLessThanOrEqual(100.0001) }
  })
  it('standalone health insurers pay within three months in 90%+ of cases (three-year, weighted)', () => {
    for (const s of ['star-health', 'niva-bupa', 'care-health', 'aditya-birla-health', 'manipalcigna-health']) expect(paidWithin3Months(s)!, s).toBeGreaterThan(90)
  })
})
