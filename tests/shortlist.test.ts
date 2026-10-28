import { describe, expect, it } from 'vitest'
import { CRITERIA, buildSection, sectionsFor } from '../src/engine/shortlist'

const spec = (id: string) => CRITERIA.find((c) => c.id === id)!

describe('shortlist guardrails', () => {
  it('Go Digit Life (3 claims, 0% paid) can never appear in a claims leaderboard', () => {
    const s = buildSection(spec('term.csr'))
    expect(s.eligible.some((l) => l.insurer.slug === 'go-digit-life')).toBe(false)
    expect(s.excluded.find((e) => e.name === 'Go Digit Life')?.reason).toMatch(/Only 3 family claims/)
  })
  it('Bandhan Life (365 claims) is excluded by the 1,000-claim floor', () => {
    const s = buildSection(spec('term.csr'))
    expect(s.eligible.some((l) => l.insurer.slug === 'bandhan-life')).toBe(false)
  })
  it('17 life insurers qualify, as in the IRDAI "1,000+ claims" cut', () => {
    expect(buildSection(spec('term.csr')).eligibleCount).toBe(17)
  })
  it('top 3 by claims paid are sorted high → low and are real, high-volume insurers', () => {
    const s = buildSection(spec('term.csr'))
    expect(s.leaders).toHaveLength(3)
    expect(s.leaders[0].value).toBeGreaterThanOrEqual(s.leaders[1].value)
    expect(s.leaders[1].value).toBeGreaterThanOrEqual(s.leaders[2].value)
    s.leaders.forEach((l) => expect(l.value).toBeGreaterThan(99))
  })
  it('health complaints per 10k only compares dedicated health insurers', () => {
    const s = buildSection(spec('health.complaints'))
    s.eligible.forEach((l) => expect(l.insurer.kind).toBe('standalone_health'))
    expect(s.excluded.some((e) => /whole company/.test(e.reason))).toBe(true)
  })
  it('lower is better for complaints rate', () => {
    const s = buildSection(spec('health.complaints'))
    for (let i = 1; i < s.eligible.length; i++) expect(s.eligible[i].value).toBeGreaterThanOrEqual(s.eligible[i - 1].value)
  })
  it('health solvency: insurers below IRDAI minimum are never leaders and are called out', () => {
    const s = buildSection(spec('health.solvency'))
    s.leaders.forEach((l) => expect(l.value).toBeGreaterThanOrEqual(1.5))
    expect(s.belowMinimum.length).toBeGreaterThan(0)
  })
  it('every section returns at most 3 leaders and never NaN', () => {
    for (const p of ['term', 'health', 'motor'] as const)
      for (const s of sectionsFor(p)) {
        expect(s.leaders.length).toBeLessThanOrEqual(3)
        s.eligible.forEach((l) => { expect(Number.isFinite(l.value)).toBe(true); expect(l.display).not.toMatch(/NaN|undefined/) })
      }
  })
})
