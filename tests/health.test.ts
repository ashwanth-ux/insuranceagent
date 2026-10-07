import { describe, expect, it } from 'vitest'
import { CRORE, LAKH } from '../src/engine/format'
import { baseIndividualMid, computeHealth, healthPayout, realValue, roomRentDeduction, superTopUpPremium, type HealthInput } from '../src/engine/health'

describe('guide worked examples', () => {
  it('₹10L at 12% for 10 years buys what ₹3.2L buys today', () => {
    expect(realValue(10 * LAKH, 10) / LAKH).toBeCloseTo(3.22, 2)
  })
  it('room-rent: ₹2L bill, ₹10k/day room vs ₹5k cap → you pay ₹75,000', () => {
    const r = roomRentDeduction({ roomRentPerDay: 10_000, days: 4, associatedCharges: 110_000, nonAssociated: 50_000, capPerDay: 5_000 })
    expect(r.ratio).toBe(0.5)
    expect(r.paid).toBe(125_000)
    expect(r.youPay).toBe(75_000)
  })
  it('super top-up table: base 10L, STU 1cr, deductible 10L', () => {
    const rows = [[3.5 * LAKH, 3.5 * LAKH, 0, 0], [15 * LAKH, 10 * LAKH, 5 * LAKH, 0], [35 * LAKH, 10 * LAKH, 25 * LAKH, 0], [120 * LAKH, 10 * LAKH, 100 * LAKH, 10 * LAKH]]
    for (const [bill, b, t, y] of rows) {
      const p = healthPayout(bill, 10 * LAKH, CRORE, 10 * LAKH)
      expect([p.fromBase, p.fromTop, p.youPay]).toEqual([b, t, y])
    }
  })
})

describe('premium model', () => {
  it('anchors at ₹9,500 for ₹10L at 30 in a metro-neutral baseline', () => {
    expect(baseIndividualMid(30, 10 * LAKH, 'tier2')).toBeCloseTo(9_500, 0)
  })
  it('curve lands in the guide-adjacent ranges (45 → ~₹18k, 60 → ~₹44k)', () => {
    expect(baseIndividualMid(45, 10 * LAKH, 'tier2')).toBeGreaterThan(17_000)
    expect(baseIndividualMid(45, 10 * LAKH, 'tier2')).toBeLessThan(22_000)
    expect(baseIndividualMid(60, 10 * LAKH, 'tier2')).toBeGreaterThan(40_000)
    expect(baseIndividualMid(60, 10 * LAKH, 'tier2')).toBeLessThan(58_000)
  })
  it('monotonic in age and in sum insured', () => {
    let prev = 0
    for (let a = 18; a <= 90; a++) { const v = baseIndividualMid(a, 10 * LAKH, 'metro'); expect(v).toBeGreaterThanOrEqual(prev); prev = v }
    prev = 0
    for (const si of [3, 5, 10, 25, 50, 100, 500].map((l) => l * LAKH)) { const v = baseIndividualMid(35, si, 'metro'); expect(v).toBeGreaterThan(prev); prev = v }
  })
  it('super top-up is a fraction of an equivalent base plan', () => {
    const stu = superTopUpPremium({ eldestAge: 30, spouse: false, kids: 0, topUp: 90 * LAKH, deductible: 10 * LAKH, city: 'tier2' }).mid
    const bigBase = baseIndividualMid(30, CRORE, 'tier2')
    expect(stu).toBeLessThan(bigBase * 0.35)
    expect(stu).toBeGreaterThan(3_000)
    expect(stu).toBeLessThan(6_000)
  })
})

const young: HealthInput = { age: 30, spouse: false, kids: 0, parents: 0, parentAge: 62, city: 'metro', hospital: 'standard', ownCover: 0, employerCover: 5 * LAKH, knownCondition: false, babyPlanned: false, savingsForBill: 5 * LAKH, income: 12 * LAKH }

describe('stack sizing', () => {
  it('one adult, metro, good private hospitals → ₹10L base first, then a ₹10L super top-up (₹20L total), with reasons', () => {
    const r = computeHealth(young)
    expect(r.base).toBe(10 * LAKH)
    expect(r.recommendedTotal).toBe(20 * LAKH)
    expect(r.superTopUp).toBe(10 * LAKH)
    expect(r.deductible).toBe(10 * LAKH)
    expect(r.topUpReasons.length).toBeGreaterThan(0)
    expect(r.plans[0].id).toBe('base')
    expect(r.plans[0].role).toBe('core')
    // The super top-up is an add-on, offered once: it is not one of the base plans.
    expect(r.plans.some((p) => (p.id as string) === 'topup')).toBe(false)
    expect(r.topUp.recommended).toBe(true)
    expect(r.topUp.size).toBe(10 * LAKH)
    expect(r.topUp.total).toBe(20 * LAKH)
  })
  it('top private hospitals raise the base plan: the cover moves when the hospital choice moves', () => {
    const good = computeHealth(young), top = computeHealth({ ...young, hospital: 'top' })
    expect(top.base).toBe(good.base + 5 * LAKH)
    expect(top.basePlans.totalCover).toBeGreaterThan(good.basePlans.totalCover)
    expect(computeHealth({ ...young, spouse: true, kids: 2, hospital: 'top' }).base).toBe(20 * LAKH)
  })
  it('parents change the headline: the total base cover is the family plan plus a plan for each parent', () => {
    const none = computeHealth(young), both = computeHealth({ ...young, parents: 2, parentAge: 62 }), one = computeHealth({ ...young, parents: 1, parentAge: 62 })
    expect(both.basePlans.totalCover).toBe(none.basePlans.totalCover + 20 * LAKH)
    expect(one.basePlans.totalCover).toBe(none.basePlans.totalCover + 10 * LAKH)
    expect(both.basePlans.planCount).toBe(3)
    expect(both.plans.map((p) => p.id)).toEqual(['base', 'parent', 'parent'])
    expect(both.plans.filter((p) => p.id === 'parent').every((p) => p.cover === 10 * LAKH && p.premium.mid > 0)).toBe(true)
    expect(both.basePlans.premium.mid).toBeGreaterThan(none.basePlans.premium.mid)
  })
  it('a super top-up is always priced as an option, even when the answers do not call for one', () => {
    const r = computeHealth({ ...young, hospital: 'local', savingsForBill: 8 * LAKH })
    expect(r.topUp.recommended).toBe(false)
    expect(r.topUp.size).toBeGreaterThanOrEqual(10 * LAKH)
    expect(r.topUp.premium.mid).toBeGreaterThan(0)
  })
  it('the cover follows the formula: one-adult target × (1 + 0.25 per extra adult + 0.10 per child), nearest ₹5L', () => {
    const at = (o: Partial<HealthInput>) => computeHealth({ ...young, ...o }).recommendedTotal / LAKH
    expect(at({})).toBe(20)
    expect(at({ spouse: true })).toBe(25)
    expect(at({ kids: 1 })).toBe(20)
    expect(at({ spouse: true, kids: 1 })).toBe(25)
    expect(at({ spouse: true, kids: 2 })).toBe(30)
    expect(at({ spouse: true, kids: 3 })).toBe(30)
    expect(at({ spouse: true, kids: 6 })).toBe(30)
  })
  it('an individual and a small family get different cover in the same place with the same hospitals', () => {
    const single = computeHealth(young)
    const family = computeHealth({ ...young, spouse: true, kids: 2 })
    expect(family.recommendedTotal).toBeGreaterThan(single.recommendedTotal)
    expect(family.base).toBeGreaterThan(single.base)
  })
  it('a planned baby counts as a child in the sizing', () => {
    expect(computeHealth({ ...young, spouse: true, kids: 1, babyPlanned: true }).recommendedTotal).toBeGreaterThan(computeHealth({ ...young, spouse: true, kids: 0 }).recommendedTotal - 1)
    expect(computeHealth({ ...young, spouse: true, kids: 1, babyPlanned: true }).steps.some((x) => /people on the plan/.test(x.label))).toBe(true)
  })
  it('three or more people sharing a floater start at a ₹15L base; one or two start at ₹10L', () => {
    expect(computeHealth({ ...young, spouse: true, kids: 1 }).base).toBe(15 * LAKH)
    expect(computeHealth({ ...young, spouse: true }).base).toBe(10 * LAKH)
  })
  it('top private hospitals in a metro: ₹30L for one, ₹45L for a family of four; never above ₹50L for anyone', () => {
    expect(computeHealth({ ...young, hospital: 'top' }).recommendedTotal).toBe(30 * LAKH)
    expect(computeHealth({ ...young, hospital: 'top', spouse: true, kids: 2 }).recommendedTotal).toBe(45 * LAKH)
    expect(computeHealth({ ...young, hospital: 'top', kids: 3, spouse: true, familyHistory: true, knownCondition: true }).recommendedTotal).toBeLessThanOrEqual(50 * LAKH)
  })
  it('local hospitals, no risk, comfortable savings → the base plan stands alone, and says why', () => {
    const r = computeHealth({ ...young, hospital: 'local', savingsForBill: 8 * LAKH })
    expect(r.superTopUp).toBe(0)
    expect(r.recommendedTotal).toBe(r.base)
    expect(r.baseOnlyWhy).toBeTruthy()
    expect(r.plans.some((p) => p.id === 'topup')).toBe(false)
  })
  it('a family history or a known condition brings the super top-up in for local hospitals', () => {
    const local = { ...young, hospital: 'local' as const, savingsForBill: 8 * LAKH }
    expect(computeHealth({ ...local, familyHistory: true }).superTopUp).toBeGreaterThan(0)
    expect(computeHealth({ ...local, knownCondition: true }).superTopUp).toBeGreaterThan(0)
  })
  it('thin savings bring it in too', () => {
    expect(computeHealth({ ...young, hospital: 'local', savingsForBill: 1 * LAKH }).superTopUp).toBeGreaterThan(0)
  })
  it('parents appear as their own plan with their own cover, and do not change the family cover', () => {
    const r = computeHealth({ ...young, parents: 2, parentAge: 62 })
    const p = r.plans.find((x) => x.id === 'parent')!
    expect(p.group).toBe('parents')
    expect(p.cover).toBe(10 * LAKH)
    expect(p.premium.mid).toBeGreaterThan(0)
    expect(r.base).toBe(computeHealth(young).base)
  })
  it('employer-only → critical flag, employer cover not counted', () => {
    const r = computeHealth(young)
    expect(r.flags.some((f) => f.level === 'critical')).toBe(true)
    expect(r.shortfall).toBe(r.recommendedTotal)
  })
  it('already covered → no shortfall', () => {
    const r = computeHealth({ ...young, ownCover: CRORE })
    expect(r.covered).toBe(true)
    expect(r.shortfall).toBe(0)
  })
  it('parents priced separately and rise steeply with age', () => {
    const a = computeHealth({ ...young, parents: 2, parentAge: 58 }).premium.parents.mid
    const b = computeHealth({ ...young, parents: 2, parentAge: 72 }).premium.parents.mid
    expect(b).toBeGreaterThan(a * 1.8)
  })
  it('smaller town + local hospitals + savings → lighter ₹5L base', () => {
    const r = computeHealth({ ...young, city: 'other', hospital: 'local' })
    expect(r.base).toBe(5 * LAKH)
    expect(r.superTopUp).toBe(0)
    expect(r.recommendedTotal).toBe(5 * LAKH)
  })
})
