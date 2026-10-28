/**
 * Plan-level knowledge base: the add-ons layer.
 * Compiled from public sources on 2026-10-05. Every record names its sources and a confidence level.
 * Plan wording changes. Treat as a shortlist aid, never as the policy document.
 */

export type Confidence = 'high' | 'medium' | 'low'

export const SOURCES = {
  dittoTerm: { id: 'dittoTerm', label: 'Ditto, Best Term Insurance Plans (12 Aug 2026)', conf: 'medium' as Confidence, note: 'Advisor and distributor; plan features read from brochures. Premiums are illustrative, without first-year discounts.' },
  pranay: { id: 'pranay', label: 'Pranay Kapoor, The only term insurance guide you need in 2026', conf: 'medium' as Confidence, note: 'Independent creator with an affiliate link to Ditto. Quotes for a 35-year-old male non-smoker. Headline says ₹3 crore, footnote and ICICI note say ₹5 crore. Our model reproduces SBI’s ₹32.8k at ₹5 crore, so we read it as ₹5 crore.' },
  dittoHealth: { id: 'dittoHealth', label: 'Ditto, Compare Health Insurance Plans (30 Jun 2026)', conf: 'medium' as Confidence, note: 'Plan features and insurer metrics for five flagship plans.' },
  nyvo: { id: 'nyvo', label: 'nyvo, Health plans with no sub-limits (1 Oct 2026)', conf: 'medium' as Confidence, note: 'From policy wording as recorded in nyvo’s database.' },
  honestMoney: { id: 'honestMoney', label: 'HonestMoney, Best car insurance companies (30 Apr 2026)', conf: 'low' as Confidence, note: 'Aggregator. Add-on terms and garage counts are approximate and change often.' },
  policybazaar: { id: 'policybazaar', label: 'Policybazaar, Car insurance claim settlement ratio', conf: 'low' as Confidence, note: 'Commercial aggregator. Garage counts only; its CSRs are rounded and unverified, so we do not use them.' },
} as const

export type Tri = boolean | null // null = not stated in our sources

/* ───────────────────────── TERM ───────────────────────── */
export interface TermPlan {
  id: string
  insurer: string
  name: string
  aliases?: string[]
  rating: number
  /** null where our sources do not state eligibility for this plan. */
  eligibility: { entryAge: [number, number]; maxMaturityAge: number; minIncomeLakh: number; minCoverLakh: number; smokerFreeMonths: number } | null
  payouts: string[]
  ci: { offered: boolean; type: 'additional' | 'accelerated' | 'unclear'; illnesses?: number; riderTermYears?: number; note?: string }
  wop: { offered: boolean; trigger: 'ci+disability' | 'disability' | 'terminal' | 'none'; note?: string }
  terminal: { builtIn: Tri; note?: string }
  accidentalDeath: Tri
  lifeStage: Tri
  premiumBreak: Tri
  smartExit: Tri
  rop: Tri
  increasingCover: Tri
  spouseCover: Tri
  advancePayout?: string
  highlights: string[]
  watch: string[]
  /** ₹2 crore to age 65, healthy non-smoker, tier-1 city, annual premium ex-GST, no first-year discount (Ditto, Sept 2026). */
  premium: { m25: number; f25: number; m35: number; f35: number }
  sources: (keyof typeof SOURCES)[]
}

export const TERM_PLANS: TermPlan[] = [
  {
    id: 'axis-smart-term-plus', insurer: 'axis-max-life', name: 'Smart Term Plan Plus', aliases: ['Smart Term Plan', 'Smart Term'], rating: 4.7,
    eligibility: { entryAge: [18, 60], maxMaturityAge: 85, minIncomeLakh: 3, minCoverLakh: 25, smokerFreeMonths: 24 },
    payouts: ['Lump sum', 'Income protection variant'],
    ci: { offered: true, type: 'additional', illnesses: 64, note: '₹30 lakh of CI cover on the ₹5 crore benchmark quote.' },
    wop: { offered: true, trigger: 'ci+disability', note: '11 specified critical illnesses and 4 disabilities.' },
    terminal: { builtIn: true, note: 'Accelerated payout up to ₹1 crore.' },
    accidentalDeath: null, lifeStage: null, premiumBreak: true, smartExit: null, rop: true, increasingCover: null, spouseCover: null,
    advancePayout: 'Up to ₹2 lakh at claim intimation',
    highlights: ['Cover Continuance Benefit: defer premiums for a year, repay later', 'Variants include whole life to 100 and return of premium'],
    watch: ['Base premium steps up about 15% from year 2 after a year-1 discount', 'Optional CI runs for a limited rider term'],
    premium: { m25: 17222, f25: 14640, m35: 26552, f35: 22570 }, sources: ['dittoTerm', 'pranay'],
  },
  {
    id: 'hdfc-click2protect-supreme-plus', insurer: 'hdfc-life', name: 'Click 2 Protect Supreme Plus', aliases: ['Click2Protect Supreme Plus'], rating: 4.4,
    eligibility: { entryAge: [18, 65], maxMaturityAge: 85, minIncomeLakh: 2.5, minCoverLakh: 50, smokerFreeMonths: 24 },
    payouts: ['Lump sum', 'Monthly income', 'Lump sum plus income'],
    ci: { offered: true, type: 'additional', illnesses: 60, riderTermYears: 15, note: '₹25 lakh of CI cover on the ₹5 crore benchmark quote.' },
    wop: { offered: true, trigger: 'ci+disability', note: 'Waives future premiums across 60 critical illnesses and disabilities. The clause Pranay Kapoor cites as the deciding difference.' },
    terminal: { builtIn: true, note: 'Terminal illness benefit capped at ₹2 crore.' },
    accidentalDeath: null, lifeStage: true, premiumBreak: true, smartExit: true, rop: null, increasingCover: null, spouseCover: null,
    advancePayout: 'Advance partial payout at claim intimation',
    highlights: ['Life-stage cover increases at marriage, childbirth, home loan', 'Premium Break: defer for 1 year, repay later', 'Smart Exit: recover eligible premiums in a window'],
    watch: ['Base premium steps up about 15% from year 2 after a year-1 discount', 'Location-based pricing: your pincode can change the quote', 'CI rider term is 15 years, shorter than a 25-year policy'],
    premium: { m25: 19719, f25: 16761, m35: 31118, f35: 26451 }, sources: ['dittoTerm', 'pranay'],
  },
  {
    id: 'icici-iprotect-smart-plus', insurer: 'icici-prudential-life', name: 'iProtect Smart Plus', aliases: ['iProtect Smart'], rating: 4.3,
    eligibility: { entryAge: [18, 60], maxMaturityAge: 85, minIncomeLakh: 3, minCoverLakh: 50, smokerFreeMonths: 12 },
    payouts: ['Lump sum', 'Regular income', 'Increasing income', 'Combination'],
    ci: { offered: true, type: 'unclear', illnesses: 60, riderTermYears: 20, note: 'Ditto says 60 illnesses. Another aggregator lists 34. ₹15 lakh of CI cover on the ₹5 crore benchmark quote, which is thin.' },
    wop: { offered: true, trigger: 'ci+disability', note: 'Standalone rider for 15 critical illnesses and total permanent disability from an accident. Bundled with CI in the benchmark quote.' },
    terminal: { builtIn: null, note: 'Not stated in our sources.' },
    accidentalDeath: null, lifeStage: true, premiumBreak: true, smartExit: true, rop: null, increasingCover: null, spouseCover: null,
    advancePayout: 'Accelerated partial payout up to ₹3 lakh at claim intimation',
    highlights: ['All-in-one rider structure', 'Life-stage protection', 'Premium Break and Smart Exit'],
    watch: ['CI cover is small relative to a large policy', 'About 16.5% year-1 discount on base premium, then higher'],
    premium: { m25: 16111, f25: 13694, m35: 26030, f35: 22126 }, sources: ['dittoTerm', 'pranay'],
  },
  {
    id: 'bajaj-etouch-ii', insurer: 'bajaj-allianz-life', name: 'eTouch II', rating: 4.2,
    eligibility: { entryAge: [18, 65], maxMaturityAge: 85, minIncomeLakh: 2.5, minCoverLakh: 50, smokerFreeMonths: 12 },
    payouts: ['Lump sum', 'Regular income'],
    ci: { offered: true, type: 'additional', illnesses: 60, riderTermYears: 20 },
    wop: { offered: true, trigger: 'disability', note: 'Accidental disability or terminal illness only.' },
    terminal: { builtIn: true, note: 'Accelerated payout up to ₹2 crore.' },
    accidentalDeath: null, lifeStage: null, premiumBreak: true, smartExit: null, rop: null, increasingCover: null, spouseCover: null,
    highlights: ['Premium Holiday add-on', 'Early exit value in some structures', 'Health management services'],
    watch: ['Insurer’s amount-settled record is below the 95% bar in our funnel'],
    premium: { m25: 15474, f25: 14482, m35: 25311, f35: 21675 }, sources: ['dittoTerm'],
  },
  {
    id: 'absl-super-term', insurer: 'aditya-birla-sun-life', name: 'Super Term Plan', rating: 4.0,
    eligibility: { entryAge: [18, 65], maxMaturityAge: 85, minIncomeLakh: 5, minCoverLakh: 25, smokerFreeMonths: 12 },
    payouts: ['Lump sum', 'Increasing cover variant', 'Return of premium variant'],
    ci: { offered: true, type: 'accelerated', illnesses: 42, note: 'Pays up to 50% of the sum assured, capped at ₹50 lakh, and reduces your remaining life cover.' },
    wop: { offered: true, trigger: 'disability', note: 'Optional, accidental total and permanent disability.' },
    terminal: { builtIn: true },
    accidentalDeath: null, lifeStage: true, premiumBreak: true, smartExit: null, rop: true, increasingCover: true, spouseCover: null,
    highlights: ['Life-stage protection', 'Cover Continuance Benefit', 'Early Exit Value on eligible variants'],
    watch: ['Accelerated CI reduces your life cover. Prefer an additional (stand-on-top) CI cover'],
    premium: { m25: 18607, f25: 16343, m35: 26507, f35: 21504 }, sources: ['dittoTerm'],
  },
  {
    id: 'tata-aia-sampoorna-raksha-promise', insurer: 'tata-aia-life', name: 'Sampoorna Raksha Promise', aliases: ['Maha Raksha Supreme Select'], rating: 4.0,
    eligibility: null,
    payouts: ['Lump sum', 'Income'],
    ci: { offered: true, type: 'additional', note: '₹30 lakh of CI cover on the ₹5 crore benchmark quote.' },
    wop: { offered: true, trigger: 'terminal', note: 'On the benchmark plan the waiver activates only on terminal illness. Pranay Kapoor’s main objection.' },
    terminal: { builtIn: true, note: 'Accelerated payout of 50% of the base sum assured, plus waiver of future premiums.' },
    accidentalDeath: true, lifeStage: null, premiumBreak: true, smartExit: null, rop: true, increasingCover: null, spouseCover: null,
    advancePayout: '₹3 lakh at claim intimation for sums of ₹1 crore or more',
    highlights: ['Cover to age 100 on eligible options', 'FlexiPay: defer premiums up to 12 months', 'Riders for CI, accidental disability, accident cover, hospitalisation'],
    watch: ['Base premium discount of about 18.5% applies in year 1 only', 'Check which waiver trigger your variant carries'],
    premium: { m25: 18059, f25: 15350, m35: 27218, f35: 23134 }, sources: ['dittoTerm', 'pranay'],
  },
  {
    id: 'kotak-e-term', insurer: 'kotak-life', name: 'e-Term Plan', rating: 4.0,
    eligibility: null,
    payouts: ['Lump sum', 'Level monthly income', 'Increasing monthly income'],
    ci: { offered: true, type: 'additional', note: 'Optional rider.' },
    wop: { offered: true, trigger: 'disability', note: 'Total and permanent disability under the Life Secure option.' },
    terminal: { builtIn: null },
    accidentalDeath: true, lifeStage: null, premiumBreak: null, smartExit: true, rop: null, increasingCover: null, spouseCover: null,
    highlights: ['Special Exit Value around age 60', 'Step-up and step-down cover', 'Free medical check-up every five years'],
    watch: ['Insurer’s amount-settled record is below the 95% bar in our funnel'],
    premium: { m25: 18360, f25: 16320, m35: 29380, f35: 23260 }, sources: ['dittoTerm'],
  },
  {
    id: 'pnb-mera-term-plan-plus', insurer: 'pnb-metlife', name: 'Mera Term Plan Plus', rating: 3.5,
    eligibility: null,
    payouts: ['Lump sum', 'Income'],
    ci: { offered: true, type: 'additional', note: 'Priced extra; check the Life Plus Health option.' },
    wop: { offered: true, trigger: 'ci+disability', note: 'Accidental total and permanent disability or 50 listed critical illnesses.' },
    terminal: { builtIn: null },
    accidentalDeath: null, lifeStage: true, premiumBreak: null, smartExit: null, rop: null, increasingCover: true, spouseCover: true,
    highlights: ['Spouse cover in the same policy', 'Step Up: sum assured rises 10% (simple) a year for ten years', 'Child education support benefit'],
    watch: ['Spouse cover, step-up and CI all cost extra', 'Complaint rate is above the industry median in our funnel'],
    premium: { m25: 18600, f25: 15800, m35: 28800, f35: 23000 }, sources: ['dittoTerm'],
  },
  {
    id: 'lic-new-tech-term', insurer: 'lic', name: 'New Tech Term', aliases: ['Tech Term'], rating: 3.5,
    eligibility: null,
    payouts: ['Lump sum'],
    ci: { offered: false, type: 'additional', note: 'No critical illness cover.' },
    wop: { offered: false, trigger: 'none', note: 'No waiver of premium.' },
    terminal: { builtIn: false },
    accidentalDeath: true, lifeStage: false, premiumBreak: false, smartExit: false, rop: false, increasingCover: true, spouseCover: false,
    highlights: ['Level or increasing cover (10% simple from year 6, up to 200%)', 'Online-only purchase', 'Sovereign-linked brand trust'],
    watch: ['A "naked" policy: no CI, no waiver, no premium break, no life-stage option', 'Not comparable like-for-like with plans that carry riders'],
    premium: { m25: 21996, f25: 19344, m35: 32204, f35: 26560 }, sources: ['dittoTerm', 'pranay'],
  },
  {
    id: 'sbi-smart-shield-plus', insurer: 'sbi-life', name: 'Smart Shield Plus', aliases: ['Smart Shield Premier'], rating: 3.4,
    eligibility: null,
    payouts: ['Lump sum'],
    ci: { offered: false, type: 'additional', note: 'No CI or waiver riders in the benchmark quote.' },
    wop: { offered: false, trigger: 'none' },
    terminal: { builtIn: false },
    accidentalDeath: true, lifeStage: true, premiumBreak: false, smartExit: false, rop: false, increasingCover: true, spouseCover: true,
    highlights: ['Increasing cover (5% a year up to 200%)', 'Future Proofing: add cover after marriage, childbirth, a house', 'Better Half Benefit for spouse'],
    watch: ['No CI or waiver of premium: a "naked" policy', 'Cheapest base price in Pranay Kapoor’s benchmark, but not like-for-like with plans carrying riders'],
    premium: { m25: 17440, f25: 15374, m35: 27748, f35: 22390 }, sources: ['dittoTerm', 'pranay'],
  },
]

/** Pranay Kapoor's like-for-like 25-year cost: 35-year-old male non-smoker, ₹5 crore to 60, with CI and WoP where offered. */
export const TERM_25YR_QUOTES = [
  { plan: 'sbi-smart-shield-plus', year1: 32808, year2: 32808, total25: 820200, ci: 0, wop: 'none' },
  { plan: 'lic-new-tech-term', year1: 41334, year2: 41334, total25: 1033350, ci: 0, wop: 'none' },
  { plan: 'icici-iprotect-smart-plus', year1: 38457, year2: 44171, total25: 1098561, ci: 15, wop: 'bundled with CI' },
  { plan: 'hdfc-click2protect-supreme-plus', year1: 42467, year2: 46908, total25: 1168259, ci: 25, wop: 'ci+disability' },
  { plan: 'axis-smart-term-plus', year1: 44873, year2: 48907, total25: 1178641, ci: 30, wop: 'ci+disability' },
  { plan: 'tata-aia-sampoorna-raksha-promise', year1: 44904, year2: 50779, total25: 1261600, ci: 30, wop: 'terminal' },
] as const

/** Rider rules of thumb distilled from the sources. These feed the add-ons page. */
export const TERM_RIDER_RULES = {
  ciMinLakh: 25,
  ciMaxLakh: 50,
  wopCostPerYear: [1500, 2500] as [number, number],
  ropIrr: '4–6% on the extra premium, usually worse than a plain index fund',
  limitedPay: 'Pay regularly and invest the difference. Limited pay costs more up front, which is an interest-free loan to the insurer.',
  premiumModal: 'Annual payment avoids a 2–5% modal loading, highest on monthly.',
  yearOneDiscount: 'Quotes carry a first-year discount of 15–18.5%. Compare the 25-year total, not year 1.',
}

/* ───────────────────────── HEALTH ───────────────────────── */
export interface HealthPlan {
  id: string
  insurer: string
  name: string
  variantNote?: string
  roomRent: 'none' | 'capped' | 'variant-dependent'
  subLimits: boolean
  coPay: 'nil' | 'variant-dependent' | 'yes'
  pedWaitYears: number
  pedReducible: boolean
  specificWaitYears: number
  restoration: string
  renewalBonus: string
  networkHospitals?: number
  highlights: string[]
  watch: string[]
  sources: (keyof typeof SOURCES)[]
}

export const HEALTH_PLANS: HealthPlan[] = [
  {
    id: 'hdfc-ergo-optima-secure-plus', insurer: 'hdfc-ergo', name: 'Optima Secure+', roomRent: 'none', subLimits: false, coPay: 'nil',
    pedWaitYears: 3, pedReducible: true, specificWaitYears: 2, restoration: 'Up to base sum insured, unlimited times',
    renewalBonus: '100% of base sum insured added every year, no ceiling, even after claims (Infinity benefit)', networkHospitals: 16000,
    highlights: ['Largest renewal bonus of the five flagships', 'No room-rent limit, no disease sub-limits, no co-pay'], watch: ['Complaint volume is lowest of the five, but PED wait is the standard 3 years unless you buy the reduction add-on'], sources: ['dittoHealth', 'nyvo'],
  },
  {
    id: 'care-supreme', insurer: 'care-health', name: 'Care Supreme', roomRent: 'none', subLimits: false, coPay: 'nil',
    pedWaitYears: 3, pedReducible: true, specificWaitYears: 2, restoration: 'Up to base sum insured, unlimited times',
    renewalBonus: '50% a year up to 100%. Add-on: 100% a year up to 500%, regardless of claims', networkHospitals: 11400,
    highlights: ['No room-rent limit, no sub-limits, no co-pay'], watch: ['Complaints per 10,000 claims sit above Ditto’s 40 limit for standalone health insurers'], sources: ['dittoHealth', 'nyvo'],
  },
  {
    id: 'abhi-activ-one-max', insurer: 'aditya-birla-health', name: 'Activ One MAX', roomRent: 'none', subLimits: false, coPay: 'nil',
    pedWaitYears: 3, pedReducible: true, specificWaitYears: 2, restoration: 'Up to base sum insured, unlimited times',
    renewalBonus: '100% a year up to 500%, irrespective of claims', networkHospitals: 16500,
    highlights: ['Large bonus irrespective of claims', 'No room-rent limit, no sub-limits, no co-pay'], watch: ['PED wait is 3 years unless reduced by add-on'], sources: ['dittoHealth', 'nyvo'],
  },
  {
    id: 'niva-reassure', insurer: 'niva-bupa', name: 'ReAssure 2.0 / 3.0', variantNote: 'Check the variant: on ReAssure 3.0 only the Black variant has no room cap. The Classic variant charges a 20% to 50% co-pay on the whole claim for any room above a general ward.',
    roomRent: 'variant-dependent', subLimits: false, coPay: 'variant-dependent',
    pedWaitYears: 3, pedReducible: true, specificWaitYears: 2, restoration: 'Up to base sum insured, unlimited times',
    renewalBonus: 'Booster+: carry forward unused cover up to 5×', networkHospitals: 10000,
    highlights: ['Booster+ carries forward unused cover'], watch: ['Variant matters: Classic carries a co-pay for room upgrades', 'Complaint rate is high among standalone insurers, but inside Ditto’s limit'], sources: ['dittoHealth', 'nyvo'],
  },
  {
    id: 'sbi-super-health-platinum-infinite', insurer: 'sbi-general', name: 'Super Health Platinum Infinite', roomRent: 'none', subLimits: false, coPay: 'nil',
    pedWaitYears: 2, pedReducible: false, specificWaitYears: 1, restoration: 'Up to 2× base sum insured, unlimited times',
    renewalBonus: '50% each year up to 100%, regardless of claims', networkHospitals: 18000,
    highlights: ['Shortest waiting periods of the five: 2 years PED, 1 year specific illnesses', 'Restoration up to 2× base'], watch: ['Smaller bonus than HDFC ERGO or Aditya Birla'], sources: ['dittoHealth'],
  },
]

export const HEALTH_PLAN_CHECKLIST = [
  { id: 'copay', label: 'Co-payment', good: 'Nil, especially under 60', note: 'You pay a fixed share of every claim otherwise.' },
  { id: 'room', label: 'Room-rent limit', good: 'None, or a single private AC room', note: 'A cap also cuts doctor, nursing and OT charges in the same ratio.' },
  { id: 'sub', label: 'Disease sub-limits', good: 'None', note: 'Cataract and joint replacement are the usual ones.' },
  { id: 'ped', label: 'Pre-existing disease wait', good: '2 years or less (3 is the legal maximum)', note: 'Some plans sell an add-on that shortens it.' },
  { id: 'cons', label: 'Consumables', good: 'Covered as standard or by a low-cost add-on', note: 'Consumables can be 5–15% of a hospital bill.' },
  { id: 'bonus', label: 'Renewal bonus', good: '50% a year or more, regardless of claims', note: 'Look for a bonus that survives a claim.' },
  { id: 'rest', label: 'Restoration', good: 'Unlimited, for related and unrelated illness', note: 'Valuable on floaters and for chronic conditions.' },
  { id: 'check', label: 'Annual health check-up', good: 'From year one, for every member', note: 'Small perk, but it catches things early.' },
] as const

/* ───────────────────────── MOTOR ───────────────────────── */
export interface MotorInsurerTerms {
  insurer: string
  garages?: { honestMoney?: number; policybazaar?: number }
  zeroDepMaxVehicleYears?: number
  zeroDepClaimsPerYear?: number | 'unlimited'
  ncbProtectClaimsPerYear?: number
  keyReplacementMax?: number
  roadsideAssist?: string
  claimSpeed?: string
  note?: string
}

export const MOTOR_INSURER_TERMS: MotorInsurerTerms[] = [
  { insurer: 'hdfc-ergo', garages: { honestMoney: 8700, policybazaar: 8200 }, zeroDepMaxVehicleYears: 7, zeroDepClaimsPerYear: 2, ncbProtectClaimsPerYear: 1, keyReplacementMax: 30000, roadsideAssist: 'Included', claimSpeed: 'Cashless typically 2–4 working days' },
  { insurer: 'sbi-general', garages: { honestMoney: 16000, policybazaar: 16000 }, zeroDepMaxVehicleYears: 5, zeroDepClaimsPerYear: 2, ncbProtectClaimsPerYear: 1, keyReplacementMax: 25000, roadsideAssist: '₹200–500 extra', claimSpeed: 'Average cashless closure about 48 hours (self-reported)' },
  { insurer: 'icici-lombard', garages: { honestMoney: 7500, policybazaar: 5900 }, zeroDepMaxVehicleYears: 5, zeroDepClaimsPerYear: 'unlimited', ncbProtectClaimsPerYear: 1, keyReplacementMax: 20000, roadsideAssist: 'Included', claimSpeed: 'Cashless typically 2–4 working days', note: 'Unlimited zero-depreciation claims a year, where most cap at two.' },
  { insurer: 'tata-aig', garages: { honestMoney: 10000, policybazaar: 7500 }, zeroDepMaxVehicleYears: 7, zeroDepClaimsPerYear: 2, ncbProtectClaimsPerYear: 1, keyReplacementMax: 25000, roadsideAssist: '₹300–500 extra', claimSpeed: 'Cashless typically 2–3 working days' },
  { insurer: 'bajaj-allianz-general', garages: { honestMoney: 7200, policybazaar: 4000 }, zeroDepMaxVehicleYears: 5, zeroDepClaimsPerYear: 2, ncbProtectClaimsPerYear: 1, keyReplacementMax: 20000, roadsideAssist: '₹200–400 extra', claimSpeed: 'Cashless 3–5 working days; reimbursement 15–25 days' },
  { insurer: 'royal-sundaram', garages: { honestMoney: 5500, policybazaar: 3300 }, claimSpeed: '85% of claims within 24 hours (self-reported, Q1 2026)' },
  { insurer: 'go-digit-general', garages: { honestMoney: 5000 }, claimSpeed: 'Cashless 2–4 working days' },
  { insurer: 'acko-general', garages: { honestMoney: 4500 }, claimSpeed: 'Minor claims under ₹25,000 within 24 hours; major claims 5–7 days' },
  { insurer: 'new-india-assurance', garages: { honestMoney: 9000, policybazaar: 3100 }, claimSpeed: 'Cashless 5–10 working days' },
  { insurer: 'national-insurance', garages: { honestMoney: 6500, policybazaar: 3100 }, claimSpeed: 'Cashless 5–10 working days' },
  { insurer: 'united-india', garages: { policybazaar: 3100 } },
  { insurer: 'oriental-insurance', garages: { policybazaar: 3100 } },
  { insurer: 'cholamandalam-ms-general', garages: { policybazaar: 8300 } },
  { insurer: 'reliance-general', garages: { policybazaar: 8200 } },
  { insurer: 'iffco-tokio', garages: { policybazaar: 4300 } },
  { insurer: 'shriram-general', garages: { policybazaar: 2000 } },
  { insurer: 'universal-sompo', garages: { policybazaar: 3500 } },
  { insurer: 'magma-general', garages: { policybazaar: 4000 } },
  { insurer: 'future-generali-general', garages: { policybazaar: 3500 } },
  { insurer: 'liberty-general', garages: { policybazaar: 4500 } },
  { insurer: 'zurich-kotak-general', garages: { policybazaar: 2327 } },
  { insurer: 'zuno-general', garages: { policybazaar: 1500 } },
]

export const MOTOR_CHECKLIST = [
  { id: 'garages', label: 'Cashless garages near you', how: 'Enter your home and office PIN code on the insurer’s website and count garages within 5 km. A national total means little.' },
  { id: 'zd', label: 'Zero-depreciation limits', how: 'How old a vehicle it covers, and how many claims a year it pays. Most cap at two.' },
  { id: 'ncb', label: 'NCB protect', how: 'Usually one claim a year. Confirm it keeps your bonus across all claims you expect.' },
  { id: 'speed', label: 'Claim speed', how: 'No insurer publishes this officially. Treat any figure as self-reported and read recent reviews.' },
  { id: 'idv', label: 'IDV', how: 'Quotes with a lower insured value look cheaper and pay less if the car is stolen or written off.' },
] as const

export const planFor = {
  term: (insurer: string) => TERM_PLANS.filter((p) => p.insurer === insurer),
  health: (insurer: string) => HEALTH_PLANS.filter((p) => p.insurer === insurer),
  motor: (insurer: string) => MOTOR_INSURER_TERMS.find((m) => m.insurer === insurer),
}
