import { describe, expect, it } from 'vitest'
import { LAKH } from '../src/engine/format'
import { claimOrPay, computeIdv, computeMotor, nextNcb, ncbAfterYears, TP_PREMIUM, type MotorInput } from '../src/engine/motor'

const car: MotorInput = {
  kind: 'car', carCc: '1000to1500', bikeCc: '150to350', age: '2to3', value: 10 * LAKH, onLoan: true, couldReplace: false,
  floodProne: false, highwayHeavy: false, streetParking: false, ncb: 35, claimSmallDents: false, carriesPassengers: false, hasPA15L: false, income: 15 * LAKH,
}

describe('IDV', () => {
  it('applies IRDAI depreciation slabs', () => {
    expect(computeIdv('car', 'lt6m', 10 * LAKH)).toBe(9.5 * LAKH)
    expect(computeIdv('car', '6m1y', 10 * LAKH)).toBe(8.5 * LAKH)
    expect(computeIdv('car', '1to2', 10 * LAKH)).toBe(8 * LAKH)
    expect(computeIdv('car', '2to3', 10 * LAKH)).toBe(7 * LAKH)
    expect(computeIdv('car', '3to4', 10 * LAKH)).toBe(6 * LAKH)
    expect(computeIdv('car', '4to5', 10 * LAKH)).toBe(5 * LAKH)
  })
  it('over five years the entered resale value is the IDV', () => {
    expect(computeIdv('car', '5plus', 3 * LAKH)).toBe(3 * LAKH)
  })
})

describe('premium', () => {
  it('third-party table matches the 2022 notified rates', () => {
    expect(TP_PREMIUM.car.upto1000).toBe(2094)
    expect(TP_PREMIUM.car['1000to1500']).toBe(3416)
    expect(TP_PREMIUM.bike['150to350']).toBe(1366)
    expect(TP_PREMIUM.bike.above350).toBe(2804)
  })
  it('playbook anchor: ₹14L IDV, 35% NCB, base policy ≈ ₹15,621 incl. GST (within 3%)', () => {
    const r = computeMotor({ ...car, age: '1to2', value: 17.5 * LAKH, hasPA15L: true })
    expect(r.idv).toBe(14 * LAKH)
    expect(Math.abs(r.premium.comprehensive.mid - 15_621) / 15_621).toBeLessThan(0.03)
  })
  it('third-party is identical at the low and high end of the range', () => {
    const r = computeMotor(car)
    expect(r.premium.comprehensive.low).toBeLessThan(r.premium.comprehensive.high)
    expect(r.premium.thirdPartyOnly.low).toBe(r.premium.thirdPartyOnly.high)
  })
})

describe('decisions', () => {
  it('loan or young vehicle → comprehensive', () => {
    expect(computeMotor(car).recommended).toBe('comprehensive')
  })
  it('old, paid-off, replaceable → third-party only is reasonable', () => {
    expect(computeMotor({ ...car, age: '5plus', value: 80_000, onLoan: false, couldReplace: true }).recommended).toBe('thirdPartyOnly')
  })
  it('flood-prone → engine protect is Take; otherwise Skip', () => {
    expect(computeMotor({ ...car, floodProne: true }).addons.find((a) => a.id === 'engineProtect')!.verdict).toBe('take')
    expect(computeMotor(car).addons.find((a) => a.id === 'engineProtect')!.verdict).toBe('skip')
  })
  it('NCB ≥35% → NCB protect is Take; none → Skip', () => {
    expect(computeMotor(car).addons.find((a) => a.id === 'ncbProtect')!.verdict).toBe('take')
    expect(computeMotor({ ...car, ncb: 0 }).addons.find((a) => a.id === 'ncbProtect')!.verdict).toBe('skip')
  })
  it('zero dep: take under 5 yrs, skip over', () => {
    expect(computeMotor(car).addons.find((a) => a.id === 'zeroDep')!.verdict).toBe('take')
    expect(computeMotor({ ...car, age: '5plus', value: 3 * LAKH }).addons.find((a) => a.id === 'zeroDep')!.verdict).toBe('skip')
  })
})

describe('NCB', () => {
  it('slabs 0/20/25/35/45/50', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(ncbAfterYears)).toEqual([0, 20, 25, 35, 45, 50, 50])
    expect(nextNcb(0)).toBe(20)
    expect(nextNcb(35)).toBe(45)
    expect(nextNcb(50)).toBe(50)
  })
  it('small claim with a big bonus → pay it yourself; big repair → claim', () => {
    const small = claimOrPay({ repairCost: 9_000, deductible: 1_000, odGross: 16_000, ncbPct: 50 })
    expect(small.claim).toBe(false)
    const big = claimOrPay({ repairCost: 120_000, deductible: 1_000, odGross: 16_000, ncbPct: 50 })
    expect(big.claim).toBe(true)
  })
})
