import { describe, expect, it } from 'vitest'
import { funnelFor, healthFunnel, termFunnel } from '../src/engine/funnel'

const names = (f: ReturnType<typeof funnelFor>) => f.survivors.map((c) => c.name).sort()

describe('term funnel reproduces the published method', () => {
  const f = termFunnel()
  it('starts from all 27 life insurers', () => expect(f.universe).toBe(27))
  it('track-record gate drops the 5 newcomers', () => expect(f.steps[0].eliminated.map((e) => e.name).sort()).toEqual(['Acko Life', 'CreditAccess Life', 'Exide Life', 'Go Digit Life', 'Sahara India Life']))
  it('amount-settled ≥95% cuts exactly the 8 Pranay Kapoor named', () => {
    expect(f.steps[1].eliminated.map((e) => e.name).sort()).toEqual(['Aditya Birla Sun Life', 'Ageas Federal Life', 'Bajaj Allianz Life', 'Future Generali Life', 'IndiaFirst Life', 'Kotak Mahindra Life', 'Reliance Nippon Life', 'Shriram Life'])
  })
  it('the six survivors are HDFC, Axis Max, Tata AIA, LIC, SBI Life, ICICI Prudential', () => {
    expect(names(f)).toEqual(['Axis Max Life', 'HDFC Life', 'ICICI Prudential Life', 'LIC', 'SBI Life', 'Tata AIA Life'])
  })
  it('every elimination has a plain-language reason with a number', () => {
    for (const s of f.steps) for (const e of s.eliminated) expect(e.reason).toMatch(/\d|Too new/)
  })
})

describe('health funnel', () => {
  const f = healthFunnel()
  it('never includes the new or personal-accident insurers', () => {
    const all = f.table.filter((c) => c.outcomes.track?.pass).map((c) => c.slug)
    for (const s of ['galaxy-health', 'narayana-health', 'shriram-general']) expect(all).not.toContain(s)
  })
  it('survivors clear every bar and include no public-sector insurer', () => {
    expect(f.survivors.length).toBeGreaterThan(2)
    for (const c of f.survivors) for (const o of Object.values(c.outcomes)) expect(o.pass).toBe(true)
    for (const s of ['national-insurance', 'oriental-insurance', 'united-india', 'new-india-assurance']) expect(f.survivors.map((c) => c.slug)).not.toContain(s)
  })
  it('standalone health insurers get the looser complaint bar', () => {
    const care = f.table.find((c) => c.slug === 'care-health')!
    expect(care.outcomes.complaints.pass).toBe(false) // 42.7 > 40
    const niva = f.table.find((c) => c.slug === 'niva-bupa')!
    expect(niva.outcomes.complaints.pass).toBe(true) // 37.1 < 40
  })
})
