import { entry, fyLabel, insurers, latest, previous, rawValue, value, type Insurer, type KbType } from './kb'

export type Product = 'term' | 'health' | 'motor'
export type Priority = 'certainty' | 'strength' | 'service'

export interface Row {
  insurer: Insurer
  value: number | null
  volumeText?: string
  volume?: number
  eligible: boolean
  reason?: string
}

export interface CriterionSpec {
  id: string
  product: Product
  type: KbType
  group: 'primary' | 'secondary'
  priority: Priority
  /** Plain name shown to the user. */
  title: string
  /** The trade term people search for. */
  term?: string
  question: string
  direction: 'higher' | 'lower'
  fmt: (n: number) => string
  plain: (n: number) => string
  /** Two values closer than this are treated as tied. */
  tieEps: number
  /** A change at least this big counts as movement year on year. */
  moveEps: number
  why: string
  watch: string[]
  floorText: string
  source: string
  rows: (period: string) => Row[]
}

export interface PendingSpec {
  id: string
  product: Product
  title: string
  term?: string
  needs: string
}

export interface Leader {
  rank: number
  insurer: Insurer
  value: number
  display: string
  plain: string
  volumeText?: string
  trend: { text: string; dir: 'up' | 'down' | 'flat' | 'none'; better: boolean | null }
  /** Within the tie margin of the insurer ranked just above. */
  near: boolean
}

export interface Section {
  spec: CriterionSpec
  period: string
  leaders: Leader[]
  eligible: Leader[]
  eligibleCount: number
  totalCount: number
  excluded: { name: string; reason: string }[]
  belowMinimum: { name: string; display: string }[]
  tieNote?: string
}

const pct2 = (n: number) => `${n.toFixed(2)}%`
const ratio2 = (n: number) => n.toFixed(2)
const lakhLives = (n: number) => (n >= 1e7 ? `${(n / 1e7).toFixed(1)} crore` : `${(n / 1e5).toFixed(1)} lakh`)

/* ───────────────────────── Floors (every floor is a named constant, shown to the user) ───────────────────────── */
export const FLOORS = {
  lifeClaims: 1000,
  solvencyMin: 1.5,
  healthLives: 1_000_000,
  healthPremiumLakh: 50_000,
  complaintsForResolution: 1000,
} as const

const lifeBase = (code: string) => (period: string): Row[] =>
  insurers('life').map((insurer) => {
    const v = value('life', code, insurer.slug, period)
    const n = rawValue('life', 'claims_paid_count_pct', insurer.slug, 'total claims count', period)
    if (v === null || n === null) return { insurer, value: null, eligible: false, reason: 'No individual death-claim figures reported by IRDAI' }
    if (n < FLOORS.lifeClaims) return { insurer, value: v, volume: n, eligible: false, reason: `Only ${n.toLocaleString('en-IN')} death claims, too few to compare` }
    return { insurer, value: v, volume: n, volumeText: `${n.toLocaleString('en-IN')} claims`, eligible: true }
  })

const lifeSolvency = (period: string): Row[] =>
  lifeBase('solvency_ratio')(period).map((r) => {
    if (r.value === null) return r
    if (r.reason && r.reason.startsWith('Only')) return r
    if (r.value < FLOORS.solvencyMin) return { ...r, eligible: false, reason: 'Below IRDAI’s minimum solvency ratio of 1.5' }
    return r
  })

const lifePersistency = (period: string): Row[] =>
  insurers('life').map((insurer) => {
    const v = value('life', 'persistency_13m_pct', insurer.slug, period)
    const n = rawValue('life', 'claims_paid_count_pct', insurer.slug, 'total claims count', period)
    if (v === null) return { insurer, value: null, eligible: false, reason: 'No persistency figure reported by IRDAI' }
    if (n === null || n < FLOORS.lifeClaims) return { insurer, value: v, eligible: false, reason: 'Too new or small to compare' }
    return { insurer, value: v, volume: n, volumeText: `${n.toLocaleString('en-IN')} claims`, eligible: true }
  })

const healthComplaintsPer10k = (period: string): Row[] =>
  insurers('health').map((insurer) => {
    if (insurer.kind === 'general')
      return { insurer, value: null, eligible: false, reason: 'Complaints cover the whole company, not only health, so a per-person rate would mislead' }
    if (insurer.kind === 'specialised') return { insurer, value: null, eligible: false, reason: 'Not a retail health insurer' }
    const c = value('health', 'grievances_reported', insurer.slug, period)
    const k = value('health', 'persons_covered_total_thousands', insurer.slug, period)
    if (c === null || k === null || k === 0) return { insurer, value: null, eligible: false, reason: 'IRDAI reports no complaints or no people covered' }
    const lives = k * 1000
    if (lives < FLOORS.healthLives) return { insurer, value: (c / lives) * 10_000, eligible: false, reason: `Only ${lakhLives(lives)} people covered, too few to compare` }
    return { insurer, value: (c / lives) * 10_000, volume: lives, volumeText: `${lakhLives(lives)} people covered`, eligible: true }
  })

const healthScale = (insurer: Insurer, period: string) => {
  const prem = value('health', 'gross_premium_total', insurer.slug, period)
  return { prem, ok: prem !== null && prem >= FLOORS.healthPremiumLakh }
}

const healthSolvency = (period: string): Row[] =>
  insurers('health').map((insurer) => {
    const v = value('health', 'solvency_ratio', insurer.slug, period)
    if (insurer.kind === 'specialised' || !insurer.consumer_listed) return { insurer, value: v, eligible: false, reason: 'Not a retail health insurer' }
    if (v === null) return { insurer, value: null, eligible: false, reason: 'No solvency ratio reported by IRDAI' }
    const { prem, ok } = healthScale(insurer, period)
    if (!ok) return { insurer, value: v, eligible: false, reason: 'Health business too small to compare' }
    if (v < FLOORS.solvencyMin) return { insurer, value: v, eligible: false, reason: 'Below IRDAI’s minimum solvency ratio of 1.5' }
    return { insurer, value: v, volume: prem ?? undefined, volumeText: 'Whole-company figure', eligible: true }
  })

const healthResolution = (period: string): Row[] =>
  insurers('health').map((insurer) => {
    const v = value('health', 'grievance_resolution_pct', insurer.slug, period)
    const c = value('health', 'grievances_reported', insurer.slug, period)
    if (insurer.kind === 'specialised' || !insurer.consumer_listed) return { insurer, value: v, eligible: false, reason: 'Not a retail health insurer' }
    if (v === null || c === null) return { insurer, value: null, eligible: false, reason: 'No complaint figures reported by IRDAI' }
    if (c < FLOORS.complaintsForResolution) return { insurer, value: v, eligible: false, reason: `Only ${Math.round(c).toLocaleString('en-IN')} complaints, too few to compare` }
    return { insurer, value: v, volume: c, volumeText: `${Math.round(c).toLocaleString('en-IN')} complaints`, eligible: true }
  })

/** Motor: IRDAI motor claim data is not in the knowledge base yet. Only whole-company financial strength is available. */
const motorSolvency = (period: string): Row[] =>
  insurers('health').map((insurer) => {
    const v = value('health', 'solvency_ratio', insurer.slug, period)
    if (insurer.kind !== 'general' || !insurer.consumer_listed) return { insurer, value: v, eligible: false, reason: 'Not a general insurer' }
    if (v === null) return { insurer, value: null, eligible: false, reason: 'No solvency ratio reported by IRDAI' }
    const { ok } = healthScale(insurer, period)
    if (!ok) return { insurer, value: v, eligible: false, reason: 'Too small to compare. Motor premium data is not loaded yet, so size is judged on health premium' }
    if (v < FLOORS.solvencyMin) return { insurer, value: v, eligible: false, reason: 'Below IRDAI’s minimum solvency ratio of 1.5' }
    return { insurer, value: v, volumeText: 'Whole-company figure', eligible: true }
  })

const watchSolvency = ['A slightly higher number does not automatically make an insurer safer. IRDAI’s minimum is 1.5.', 'It describes the financial cushion. It does not tell you how an insurer handles claims or service.']

export const CRITERIA: CriterionSpec[] = [
  {
    id: 'term.csr', product: 'term', type: 'life', group: 'primary', priority: 'certainty',
    title: 'Claims paid', term: 'Claim settlement ratio, by number', question: 'How often do they pay?',
    direction: 'higher', fmt: pct2, tieEps: 0.05, moveEps: 1,
    plain: (n) => `About ${n.toFixed(1)} of every 100 death claims were paid.`,
    why: 'The share of death claims an insurer paid. It is the first thing to check, but never the only one.',
    watch: ['Covers death claims on every kind of individual policy, not term alone. IRDAI publishes no term-only figure.', 'It is the insurer’s past record, not the chance your own claim is paid.', 'It counts claims, not money.'],
    floorText: `Only insurers with at least ${FLOORS.lifeClaims.toLocaleString('en-IN')} individual death claims in the year, so a handful of cases cannot swing a percentage.`,
    source: 'IRDAI Handbook 2024-25, Table 15', rows: lifeBase('claims_paid_count_pct'),
  },
  {
    id: 'term.asr', product: 'term', type: 'life', group: 'primary', priority: 'certainty',
    title: 'Claim money paid', term: 'Claim settlement ratio, by amount', question: 'How much of the money do they pay?',
    direction: 'higher', fmt: pct2, tieEps: 0.05, moveEps: 1,
    plain: (n) => `About ₹${n.toFixed(1)} of every ₹100 claimed was paid out.`,
    why: 'A big claim and a small claim count the same by number. By amount shows whether large claims get paid.',
    watch: ['A gap between this and claims paid by number means larger claims were turned down more often.', 'IRDAI’s aggregate data does not show which claims were unpaid or why.'],
    floorText: `Only insurers with at least ${FLOORS.lifeClaims.toLocaleString('en-IN')} individual death claims in the year.`,
    source: 'IRDAI Handbook 2024-25, Table 15', rows: lifeBase('claims_paid_amount_pct'),
  },
  {
    id: 'term.solvency', product: 'term', type: 'life', group: 'primary', priority: 'strength',
    title: 'Financial cushion', term: 'Solvency ratio', question: 'Can they pay for decades?',
    direction: 'higher', fmt: ratio2, tieEps: 0.05, moveEps: 0.1,
    plain: (n) => `Held ${n.toFixed(2)}× the margin IRDAI requires.`,
    why: 'Term cover can run 30 years. The solvency ratio compares what an insurer holds with what IRDAI requires it to keep.',
    watch: watchSolvency,
    floorText: `Only insurers with at least ${FLOORS.lifeClaims.toLocaleString('en-IN')} death claims, and at or above IRDAI’s minimum of ${FLOORS.solvencyMin}.`,
    source: 'IRDAI Handbook 2024-25, Table 23', rows: lifeSolvency,
  },
  {
    id: 'term.persistency', product: 'term', type: 'life', group: 'secondary', priority: 'service',
    title: 'Policies kept', term: '13th-month persistency', question: 'Do customers stay?',
    direction: 'higher', fmt: pct2, tieEps: 0.5, moveEps: 1,
    plain: (n) => `${n.toFixed(0)} of every 100 policies were still active after a year.`,
    why: 'Policies that lapse stop paying. This is a clue to how a product is sold and priced.',
    watch: ['It reflects affordability, product mix and how policies were sold, not only insurer quality.'],
    floorText: `Only insurers with at least ${FLOORS.lifeClaims.toLocaleString('en-IN')} death claims.`,
    source: 'IRDAI Handbook 2024-25, Table 28', rows: lifePersistency,
  },
  {
    id: 'health.complaints', product: 'health', type: 'health', group: 'primary', priority: 'service',
    title: 'Complaints per 10,000 people', term: 'Grievances per 10,000 lives covered', question: 'How often do customers complain?',
    direction: 'lower', fmt: (n) => n.toFixed(1), tieEps: 0.1, moveEps: 0.1,
    plain: (n) => `About ${n.toFixed(1)} complaints for every 10,000 people covered.`,
    why: 'Raw complaint counts reward small insurers. A rate per 10,000 people covered is fairer.',
    watch: ['Computed only for dedicated health insurers. General insurers report complaints for the whole company, so a per-person health rate would mislead.', 'People covered includes group and government schemes.'],
    floorText: `Only dedicated health insurers with at least ${lakhLives(FLOORS.healthLives)} people covered.`,
    source: 'IRDAI Handbook 2024-25, Tables 56 and 58', rows: healthComplaintsPer10k,
  },
  {
    id: 'health.solvency', product: 'health', type: 'health', group: 'primary', priority: 'strength',
    title: 'Financial cushion', term: 'Solvency ratio', question: 'Can they pay for decades?',
    direction: 'higher', fmt: ratio2, tieEps: 0.05, moveEps: 0.1,
    plain: (n) => `Held ${n.toFixed(2)}× the margin IRDAI requires.`,
    why: 'Health premiums are renewed for life. A strong cushion matters over decades.',
    watch: ['Solvency covers the whole company, not just its health business.', ...watchSolvency],
    floorText: `Only insurers with at least ₹${(FLOORS.healthPremiumLakh / 100).toLocaleString('en-IN')} crore of health premium, and at or above IRDAI’s minimum of ${FLOORS.solvencyMin}.`,
    source: 'IRDAI Handbook 2024-25, Table 49', rows: healthSolvency,
  },
  {
    id: 'health.resolution', product: 'health', type: 'health', group: 'secondary', priority: 'service',
    title: 'Complaints attended', term: 'Grievances attended as % of reported', question: 'Do they respond?',
    direction: 'higher', fmt: pct2, tieEps: 0.05, moveEps: 1,
    plain: (n) => `${n.toFixed(1)} of every 100 complaints were attended to in the year.`,
    why: 'How much of the complaint pile an insurer worked through.',
    watch: ['Many insurers attend almost every complaint, so this rarely separates them.', 'Whole-company figure, not only health.'],
    floorText: `Only insurers with at least ${FLOORS.complaintsForResolution.toLocaleString('en-IN')} complaints in the year.`,
    source: 'IRDAI Handbook 2024-25, Table 56', rows: healthResolution,
  },
  {
    id: 'motor.solvency', product: 'motor', type: 'health', group: 'primary', priority: 'strength',
    title: 'Financial cushion', term: 'Solvency ratio', question: 'Can they pay when it matters?',
    direction: 'higher', fmt: ratio2, tieEps: 0.05, moveEps: 0.1,
    plain: (n) => `Held ${n.toFixed(2)}× the margin IRDAI requires.`,
    why: 'Motor claims can be sudden and large, including third-party injury claims that run for years.',
    watch: ['Whole-company figure for general insurers.', ...watchSolvency],
    floorText: `Only general insurers with at least ₹${(FLOORS.healthPremiumLakh / 100).toLocaleString('en-IN')} crore of health premium, as a size marker until motor premium data is loaded, and at or above IRDAI’s minimum of ${FLOORS.solvencyMin}.`,
    source: 'IRDAI Handbook 2024-25, Table 49', rows: motorSolvency,
  },
]

/** Metrics we want but cannot honestly compute from the data we hold. Shown quietly, never faked. */
export const PENDING: PendingSpec[] = [
  { id: 'health.asr', product: 'health', title: 'Claim money paid, by amount', term: 'Claim settlement ratio, by amount', needs: 'insurer-wise health claim amounts, which IRDAI publishes only for the whole industry' },
  { id: 'motor.csr', product: 'motor', title: 'Motor claims paid', term: 'Claim settlement ratio', needs: 'insurer-wise motor-only claim data, which IRDAI does not publish' },
  { id: 'motor.c10k', product: 'motor', title: 'Motor complaints per 10,000 policies', term: 'Grievances per 10,000 policies', needs: 'motor-only policy counts and complaints, which are reported only for the whole company' },
]

/* ───────────────────────── Ranking ───────────────────────── */
function trendOf(spec: CriterionSpec, cur: number, prev: number | null, prevPeriod: string): Leader['trend'] {
  if (prev === null) return { text: 'No prior-year figure', dir: 'none', better: null }
  const d = cur - prev
  if (Math.abs(d) < spec.moveEps) return { text: `Steady vs ${fyLabel(prevPeriod)}`, dir: 'flat', better: null }
  const up = d > 0
  const better = spec.direction === 'higher' ? up : !up
  return { text: `${up ? 'Rose' : 'Fell'} from ${spec.fmt(prev)} in ${fyLabel(prevPeriod)}`, dir: up ? 'up' : 'down', better }
}

export function buildSection(spec: CriterionSpec, period = latest(spec.type)): Section {
  const prevPeriod = previous(spec.type)
  const rows = spec.rows(period)
  const prevRows = new Map(spec.rows(prevPeriod).map((r) => [r.insurer.slug, r.value]))
  const eligibleRows = rows.filter((r) => r.eligible && r.value !== null)
  const sign = spec.direction === 'higher' ? -1 : 1
  const rounded = (n: number) => Math.round(n * 100) / 100
  eligibleRows.sort((a, b) => sign * (rounded(a.value!) - rounded(b.value!)) || (b.volume ?? 0) - (a.volume ?? 0) || a.insurer.name.localeCompare(b.insurer.name))

  const toLeader = (r: Row, i: number): Leader => ({
    rank: i + 1,
    insurer: r.insurer,
    value: r.value!,
    display: spec.fmt(r.value!),
    plain: spec.plain(r.value!),
    volumeText: r.volumeText,
    trend: trendOf(spec, r.value!, prevRows.get(r.insurer.slug) ?? null, prevPeriod),
    near: false,
  })
  const eligible = eligibleRows.map(toLeader)
  eligible.forEach((l, i) => { if (i > 0) l.near = Math.abs(l.value - eligible[i - 1].value) <= spec.tieEps })
  const leaders = eligible.slice(0, 3)

  let tieNote: string | undefined
  if (eligible.length > 3) {
    const topVal = eligible[0].value
    const tiedAtTop = eligible.filter((l) => Math.abs(l.value - topVal) <= spec.tieEps).length
    if (tiedAtTop > 3) tieNote = `${tiedAtTop} insurers are effectively tied at the top, so the order of the first three is not meaningful.`
    else if (Math.abs(eligible[2].value - eligible[3].value) <= spec.tieEps) tieNote = `${eligible[3].insurer.name} (${eligible[3].display}) is within ${spec.tieEps} of third place. Treat the third spot as a tie.`
  }

  const excluded = rows.filter((r) => !r.eligible).map((r) => ({ name: r.insurer.name, reason: r.reason ?? 'Not comparable' }))
  const belowMinimum = rows
    .filter((r) => !r.eligible && r.reason?.startsWith('Below IRDAI') && r.value !== null)
    .map((r) => ({ name: r.insurer.name, display: spec.fmt(r.value!) }))

  return { spec, period, leaders, eligible, eligibleCount: eligible.length, totalCount: rows.length, excluded, belowMinimum, tieNote }
}

export const sectionsFor = (product: Product, group?: 'primary' | 'secondary'): Section[] =>
  CRITERIA.filter((c) => c.product === product && (!group || c.group === group)).map((c) => buildSection(c))

export const pendingFor = (product: Product) => PENDING.filter((p) => p.product === product)

export const priorityOrder: Record<Priority, Priority[]> = {
  certainty: ['certainty', 'strength', 'service'],
  strength: ['strength', 'certainty', 'service'],
  service: ['service', 'certainty', 'strength'],
}

export function orderSections(sections: Section[], priority: Priority): Section[] {
  const order = priorityOrder[priority]
  return [...sections].sort((a, b) => order.indexOf(a.spec.priority) - order.indexOf(b.spec.priority))
}

export { entry }
