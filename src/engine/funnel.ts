import dittoHealthRaw from '../data/ditto-health.json'
import dittoTermRaw from '../data/ditto-term.json'
import { insurerBySlug, insurers, value as kbValue } from './kb'
import type { Product } from './shortlist'

/* ───────────────────────── Sources ───────────────────────── */
interface DittoRow { avg?: number | null; years?: Record<string, number>; value?: number | null; display?: string }
interface DittoMetric { avgWindow: string | null; rows: Record<string, DittoRow>; median: number | null; mean: number | null }
interface Ditto { source: string; metrics: Record<string, DittoMetric> }
const TERM = dittoTermRaw as unknown as Ditto
const HEALTH = dittoHealthRaw as unknown as Ditto

export const FUNNEL_SOURCES = {
  term: [TERM.source, 'IRDAI Handbook on Indian Insurance Statistics 2024-25: Table 18 (30-day settlement), Table 10 (policies in force), Table 37 (grievances).'],
  health: [HEALTH.source, 'IRDAI Handbook 2024-25: Table 49 (solvency), Table 53 (claims paid within 3 months).'],
} as const

/* ───────────────────────── Types ───────────────────────── */
export interface Cell {
  /** Numeric value used by the rule, if any. */
  value: number | null
  display: string
}

export interface StepOutcome {
  pass: boolean
  value: number | null
  display: string
  /** Why it failed, in plain words. */
  reason?: string
}

export interface FunnelStep {
  id: string
  kind: 'gate' | 'filter' | 'check'
  /** Short title shown on the funnel. */
  title: string
  /** The rule in one plain sentence, with its number. */
  rule: string
  /** Where the bar comes from. */
  basis: string
  source: string
  /** Rows that reach this step are tested. */
  test: (slug: string) => StepOutcome
}

export interface Candidate {
  slug: string
  name: string
  outcomes: Record<string, StepOutcome>
}

export interface StepResult {
  step: FunnelStep
  entering: number
  passed: Candidate[]
  eliminated: { slug: string; name: string; display: string; reason: string }[]
}

export interface Funnel {
  product: Product
  title: string
  universe: number
  steps: StepResult[]
  survivors: Candidate[]
  /** Everyone in the universe, with every outcome, for the "see all" table. */
  table: Candidate[]
  vintage: string
  sources: readonly string[]
  /** What we would add to make this stronger. */
  pending: string[]
  caveats: string[]
}

const nm = (slug: string, product: Product) => insurerBySlug(product === 'term' ? 'life' : 'health', slug)?.name ?? slug
const pct2 = (n: number) => `${n.toFixed(2)}%`
const avg = (m: DittoMetric, s: string) => m.rows[s]?.avg ?? null

/* ───────────────────────── TERM ───────────────────────── */
export const TERM_BARS = {
  asrMin: 95,
  complaintsMax: 'industry median',
  solvencyMin: 1.5,
  gwpMinCr: 5000,
} as const

export function termFunnel(): Funnel {
  const M = TERM.metrics
  const universe = insurers('life').map((i) => i.slug)
  const asrW = M.asr.avgWindow ?? 'FY2023-2025'

  // Industry median of complaints over insurers with a track record. Ditto's own published median is 13.09.
  const tracked = universe.filter((s) => avg(M.asr, s) !== null && avg(M.csr, s) !== null)
  const comps = tracked.map((s) => avg(M.complaints10k, s)).filter((x): x is number => x !== null).sort((a, b) => a - b)
  const median = comps.length ? (comps.length % 2 ? comps[(comps.length - 1) / 2] : (comps[comps.length / 2 - 1] + comps[comps.length / 2]) / 2) : 0
  const dittoMedian = M.complaints10k.median ?? median
  const bar = Math.round((M.complaints10k.median ?? median) * 100) / 100

  const steps: FunnelStep[] = [
    {
      id: 'track', kind: 'gate', title: 'Enough track record', rule: 'Needs three years of claims data, so a good start cannot pass for a good record.',
      basis: 'Newer insurers have too little history to average.', source: TERM.source,
      test: (s) => {
        const ok = avg(M.asr, s) !== null && avg(M.csr, s) !== null
        return { pass: ok, value: null, display: ok ? 'Yes' : 'No', reason: ok ? undefined : 'Too new: no three-year amount-settled record yet' }
      },
    },
    {
      id: 'asr', kind: 'filter', title: 'Pays the money', rule: `Amount settled of ${TERM_BARS.asrMin}% or more, three-year average.`,
      basis: 'By number, nearly every insurer pays 98%+, so it cannot separate good from bad. By amount, a company can settle 99% of claims yet pay far less per rupee claimed.', source: TERM.source,
      test: (s) => {
        const v = avg(M.asr, s)
        if (v === null) return { pass: false, value: null, display: '—', reason: 'No amount-settled figure' }
        return { pass: v >= TERM_BARS.asrMin, value: v, display: pct2(v), reason: v >= TERM_BARS.asrMin ? undefined : `Paid ${v.toFixed(1)}% of the amount claimed, below ${TERM_BARS.asrMin}% (${asrW.replace('FY', 'FY ')})` }
      },
    },
    {
      id: 'complaints', kind: 'filter', title: 'Fewer complaints', rule: `At or below the industry median of ${bar} complaints per 10,000 claims, three-year average.`,
      basis: 'High complaints mean customers are regularly fighting for what they were promised. A 25-year commitment should not go to a company that cannot clear the median.', source: TERM.source,
      test: (s) => {
        const v = avg(M.complaints10k, s)
        if (v === null) return { pass: false, value: null, display: '—', reason: 'No complaint figure' }
        return { pass: v <= bar, value: v, display: v.toFixed(1), reason: v <= bar ? undefined : `${v.toFixed(1)} complaints per 10,000 claims, above the median of ${bar}` }
      },
    },
    {
      id: 'solvency', kind: 'check', title: 'Can pay today', rule: `Solvency of ${TERM_BARS.solvencyMin} or more in the latest year. IRDAI’s minimum is 1.5.`,
      basis: 'Validation, not a ranking. Higher is not automatically safer.', source: TERM.source,
      test: (s) => {
        const v = TERM.metrics.solvency.rows[s]?.years?.['FY2025-26'] ?? kbValue('life', 'solvency_ratio', s)
        if (v === null || v === undefined) return { pass: false, value: null, display: '—', reason: 'No solvency figure' }
        return { pass: v >= TERM_BARS.solvencyMin, value: v, display: v.toFixed(2), reason: v >= TERM_BARS.solvencyMin ? undefined : `Solvency ${v.toFixed(2)}, below IRDAI’s 1.5 minimum` }
      },
    },
    {
      id: 'scale', kind: 'check', title: 'Will exist in 25 years', rule: `New-business premium of ₹${TERM_BARS.gwpMinCr.toLocaleString('en-IN')} crore or more a year.`,
      basis: 'Scale is a proxy for staying power when your family may file a claim decades from now.', source: TERM.source,
      test: (s) => {
        const v = avg(M.volumeCr, s)
        if (v === null) return { pass: false, value: null, display: '—', reason: 'No premium-volume figure' }
        return { pass: v >= TERM_BARS.gwpMinCr, value: v, display: `₹${Math.round(v).toLocaleString('en-IN')} cr`, reason: v >= TERM_BARS.gwpMinCr ? undefined : `New-business premium ₹${Math.round(v).toLocaleString('en-IN')} crore, below ₹${TERM_BARS.gwpMinCr.toLocaleString('en-IN')} crore` }
      },
    },
  ]
  return run('term', 'Life insurers', universe, steps, 'FY2024-26 averages (amount settled FY2023-25)', FUNNEL_SOURCES.term, [], [
    `Complaints median is ${dittoMedian} per 10,000 claims across insurers with a track record, as published by Ditto.`,
    'Claims figures cover each insurer’s individual life business, not term alone. IRDAI publishes no term-only figure.',
    'Amount-settled data runs to FY2024-25. FY2025-26 is not yet published for that metric.',
  ])
}

/* ───────────────────────── HEALTH ───────────────────────── */
export const HEALTH_BARS = {
  csrMin: 90,
  icrMin: 55,
  icrMax: 85,
  complaintsGeneral: 20,
  complaintsSahi: 40,
  gwpMinCr: 2500,
  networkMin: 10000,
  solvencyMin: 1.5,
} as const

export function healthFunnel(): Funnel {
  const M = HEALTH.metrics
  const universe = insurers('health')
    .filter((i) => i.kind !== 'specialised' && i.consumer_listed && M.csr.rows[i.slug] !== undefined)
    .map((i) => i.slug)
  const isSahi = (s: string) => insurerBySlug('health', s)?.kind === 'standalone_health'
  const fy = (w: string | null) => (w ?? '').replace('FY', 'FY ')

  const steps: FunnelStep[] = [
    {
      id: 'track', kind: 'gate', title: 'Real health track record', rule: 'At least three years of data, and health must be the business, not a side line.',
      basis: 'New insurers show very high early numbers on very few claims. Ditto itself says not to rank them above established insurers.', source: HEALTH.source,
      test: (s) => {
        const years = Object.keys(M.csr.rows[s]?.years ?? {}).length
        const newcomer = ['galaxy-health', 'narayana-health'].includes(s)
        const paOnly = s === 'shriram-general'
        const ok = years >= 3 && !newcomer && !paOnly
        return { pass: ok, value: null, display: ok ? 'Yes' : 'No', reason: ok ? undefined : paOnly ? 'Mainly personal accident, not health' : 'Too new for a meaningful three-year record' }
      },
    },
    {
      id: 'csr', kind: 'filter', title: 'Settles claims', rule: `Claim settlement ratio of ${HEALTH_BARS.csrMin}% or more, three-year average.`,
      basis: 'Anything below 85% is a red flag. The industry average is about 92%.', source: HEALTH.source,
      test: (s) => {
        const v = M.csr.rows[s]?.avg ?? null
        if (v === null) return { pass: false, value: null, display: '—', reason: 'No settlement figure' }
        return { pass: v >= HEALTH_BARS.csrMin, value: v, display: pct2(v), reason: v >= HEALTH_BARS.csrMin ? undefined : `Settled ${v.toFixed(1)}% of claims, below ${HEALTH_BARS.csrMin}% (${fy(M.csr.avgWindow)})` }
      },
    },
    {
      id: 'icr', kind: 'filter', title: 'Pays out sustainably', rule: `Claims paid at ${HEALTH_BARS.icrMin}% to ${HEALTH_BARS.icrMax}% of premium, three-year average.`,
      basis: 'Too low can mean tight claim handling. Too high can mean financial strain and future premium hikes.', source: HEALTH.source,
      test: (s) => {
        const v = M.icr.rows[s]?.avg ?? null
        if (v === null) return { pass: false, value: null, display: '—', reason: 'No incurred-claims figure' }
        const ok = v >= HEALTH_BARS.icrMin && v <= HEALTH_BARS.icrMax
        return { pass: ok, value: v, display: pct2(v), reason: ok ? undefined : v > HEALTH_BARS.icrMax ? `Paid ${v.toFixed(0)}% of premium as claims, above ${HEALTH_BARS.icrMax}%: pricing strain` : `Paid ${v.toFixed(0)}% of premium as claims, below ${HEALTH_BARS.icrMin}%` }
      },
    },
    {
      id: 'complaints', kind: 'filter', title: 'Fewer complaints', rule: `Under ${HEALTH_BARS.complaintsGeneral} complaints per 10,000 claims for general insurers, under ${HEALTH_BARS.complaintsSahi} for dedicated health insurers.`,
      basis: 'Dedicated health insurers handle only complex multi-stage claims, so they get the looser bar. General insurers’ complaints cover every product line.', source: HEALTH.source,
      test: (s) => {
        const v = M.complaints10k.rows[s]?.avg ?? null
        const lim = isSahi(s) ? HEALTH_BARS.complaintsSahi : HEALTH_BARS.complaintsGeneral
        if (v === null) return { pass: false, value: null, display: '—', reason: 'No complaint figure' }
        return { pass: v < lim, value: v, display: v.toFixed(1), reason: v < lim ? undefined : `${v.toFixed(1)} complaints per 10,000 claims, above the ${lim} limit` }
      },
    },
    {
      id: 'scale', kind: 'check', title: 'Scale', rule: `Health premium of ₹${HEALTH_BARS.gwpMinCr.toLocaleString('en-IN')} crore or more a year.`,
      basis: 'A larger insurer has invested more in claims systems and hospital networks.', source: HEALTH.source,
      test: (s) => {
        const v = M.gwpCr.rows[s]?.avg ?? null
        if (v === null) return { pass: false, value: null, display: '—', reason: 'No premium figure' }
        return { pass: v >= HEALTH_BARS.gwpMinCr, value: v, display: `₹${Math.round(v).toLocaleString('en-IN')} cr`, reason: v >= HEALTH_BARS.gwpMinCr ? undefined : `Health premium ₹${Math.round(v).toLocaleString('en-IN')} crore, below ₹${HEALTH_BARS.gwpMinCr.toLocaleString('en-IN')} crore` }
      },
    },
    {
      id: 'network', kind: 'check', title: 'Cashless reach', rule: `${HEALTH_BARS.networkMin.toLocaleString('en-IN')} or more network hospitals.`,
      basis: 'Check your own city. A big national number can still leave your nearby hospitals out.', source: HEALTH.source,
      test: (s) => {
        const v = M.network.rows[s]?.value ?? null
        if (v === null) return { pass: false, value: null, display: '—', reason: 'No network figure' }
        return { pass: v >= HEALTH_BARS.networkMin, value: v, display: `${v.toLocaleString('en-IN')}+`, reason: v >= HEALTH_BARS.networkMin ? undefined : `${v.toLocaleString('en-IN')}+ network hospitals, below ${HEALTH_BARS.networkMin.toLocaleString('en-IN')}` }
      },
    },
    {
      id: 'solvency', kind: 'check', title: 'Can pay today', rule: `Solvency of ${HEALTH_BARS.solvencyMin} or more. IRDAI’s minimum is 1.5.`,
      basis: 'Whole-company figure from the IRDAI Handbook.', source: 'IRDAI Handbook 2024-25, Table 49',
      test: (s) => {
        const v = kbValue('health', 'solvency_ratio', s)
        if (v === null) return { pass: false, value: null, display: '—', reason: 'No solvency figure' }
        return { pass: v >= HEALTH_BARS.solvencyMin, value: v, display: v.toFixed(2), reason: v >= HEALTH_BARS.solvencyMin ? undefined : `Solvency ${v.toFixed(2)}, below IRDAI’s 1.5 minimum` }
      },
    },
  ]
  return run('health', 'Health insurers', universe, steps, 'FY2024-26 averages (ICR FY2023-25)', FUNNEL_SOURCES.health, [], [
    'Claim settlement figures come from insurers’ own public disclosures, not IRDAI’s handbook, and use a different formula from the handbook.',
    'Complaint counts at general insurers cover every product line, not only health.',
    'Premium and incurred-claims figures include personal accident and travel for some general insurers, so they differ from the IRDAI Handbook’s health-only figures.',
  ])
}

/* ───────────────────────── Runner ───────────────────────── */
function run(product: Product, title: string, universe: string[], steps: FunnelStep[], vintage: string, sources: readonly string[], pending: string[], caveats: string[]): Funnel {
  const name = (s: string) => nm(s, product)
  const table: Candidate[] = universe.map((s) => ({ slug: s, name: name(s), outcomes: {} }))
  const byslug = new Map(table.map((c) => [c.slug, c]))
  let alive = [...universe]
  const results: StepResult[] = []
  for (const step of steps) {
    const entering = alive.length
    const passed: string[] = []
    const eliminated: StepResult['eliminated'] = []
    for (const s of alive) {
      const o = step.test(s)
      byslug.get(s)!.outcomes[step.id] = o
      if (o.pass) passed.push(s)
      else eliminated.push({ slug: s, name: name(s), display: o.display, reason: o.reason ?? 'Did not pass' })
    }
    // Still compute outcomes for already-eliminated insurers so "see all" is complete.
    for (const c of table) if (!(step.id in c.outcomes)) c.outcomes[step.id] = step.test(c.slug)
    results.push({ step, entering, passed: passed.map((s) => byslug.get(s)!), eliminated })
    alive = passed
  }
  return { product, title, universe: universe.length, steps: results, survivors: alive.map((s) => byslug.get(s)!), table, vintage, sources, pending, caveats }
}

export const funnelFor = (product: Product): Funnel => (product === 'term' ? termFunnel() : healthFunnel())

/** Leaders on a single metric among funnel survivors, so the user can see who is best at what without a combined score. */
export function leadersAmongSurvivors(f: Funnel, stepId: string, direction: 'higher' | 'lower', n = 3) {
  const rows = f.survivors.map((c) => ({ c, o: c.outcomes[stepId] })).filter((x) => x.o?.value !== null && x.o?.value !== undefined)
  rows.sort((a, b) => (direction === 'higher' ? b.o.value! - a.o.value! : a.o.value! - b.o.value!))
  return rows.slice(0, n).map((x, i) => ({ rank: i + 1, slug: x.c.slug, name: x.c.name, display: x.o.display }))
}
