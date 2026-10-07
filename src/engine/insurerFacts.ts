import dittoHealthRaw from '../data/ditto-health.json'
import dittoTermRaw from '../data/ditto-term.json'
import gicRaw from '../data/gic.json'
import { MOTOR_INSURER_TERMS } from '../data/plans'
import { value as kbValue } from './kb'
import { life30Day, lifeComplaintsPer10kPolicies, paidWithin3Months } from './handbook'
import type { Product } from './shortlist'

interface Row { avg?: number | null; years?: Record<string, number>; value?: number | null }
interface M { rows: Record<string, Row> }
const T = (dittoTermRaw as unknown as { metrics: Record<string, M> }).metrics
const H = (dittoHealthRaw as unknown as { metrics: Record<string, M> }).metrics
const G = (gicRaw as unknown as { insurers: Record<string, { motor: Record<string, number | null>; motorShare: number | null }> }).insurers

export interface Fact {
  key: string
  label: string
  value: string
  /** Numeric value for ranking leaders, if the measure can be ranked. */
  n: number | null
  direction?: 'higher' | 'lower'
  basis?: string
}

const p2 = (n: number | null | undefined) => (n === null || n === undefined ? null : n)
const crore = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')} cr`

export function factsFor(product: Product, slug: string): Fact[] {
  if (product === 'term') {
    const csr = p2(T.csr.rows[slug]?.avg), asr = p2(T.asr.rows[slug]?.avg), d30 = life30Day(slug), c = p2(T.complaints10k.rows[slug]?.avg), cp = lifeComplaintsPer10kPolicies(slug)
    const sol = T.solvency.rows[slug]?.years?.['FY2025-26'] ?? kbValue('life', 'solvency_ratio', slug), gwp = p2(T.volumeCr.rows[slug]?.avg)
    return [
      { key: 'csr', label: 'Claims paid, by number', value: csr === null ? '—' : `${csr.toFixed(2)}%`, n: csr, direction: 'higher', basis: 'Three-year average, FY2024-26' },
      { key: 'asr', label: 'Claims paid, by amount', value: asr === null ? '—' : `${asr.toFixed(2)}%`, n: asr, direction: 'higher', basis: 'Three-year average, FY2023-25' },
      { key: 'd30', label: 'Settled within 30 days', value: d30 === null ? '—' : `${d30.toFixed(1)}%`, n: d30, direction: 'higher', basis: 'IRDAI Handbook Table 18, counted from intimation, FY2022-25' },
      { key: 'complaints', label: 'Complaints per 10,000 claims', value: c === null ? '—' : c.toFixed(1), n: c, direction: 'lower', basis: 'Three-year average, FY2024-26' },
      { key: 'solvency', label: 'Solvency ratio', value: sol === null || sol === undefined ? '—' : sol.toFixed(2), n: sol ?? null, direction: 'higher', basis: 'FY2025-26' },
      { key: 'scale', label: 'New-business premium', value: gwp === null ? '—' : crore(gwp), n: gwp, direction: 'higher', basis: 'Three-year average' },
      { key: 'c10kPol', label: 'Complaints per 10,000 policies', value: cp === null ? '—' : cp.toFixed(1), n: cp, direction: 'lower', basis: 'FY2024-25: IRDAI grievances ÷ individual policies in force' },
    ]
  }
  if (product === 'health') {
    const sahi = slug.endsWith('-health') || ['star-health', 'niva-bupa', 'care-health'].includes(slug)
    const t3m = paidWithin3Months(slug)
    const csr = p2(H.csr.rows[slug]?.avg), icr = p2(H.icr.rows[slug]?.avg), c = p2(H.complaints10k.rows[slug]?.avg), net = p2(H.network.rows[slug]?.value), gwp = p2(H.gwpCr.rows[slug]?.avg), sol = kbValue('health', 'solvency_ratio', slug)
    return [
      { key: 'csr', label: 'Claims settled', value: csr === null ? '—' : `${csr.toFixed(1)}%`, n: csr, direction: 'higher', basis: 'Three-year average, FY2024-26' },
      { key: 'complaints', label: 'Complaints per 10,000 claims', value: c === null ? '—' : c.toFixed(1), n: c, direction: 'lower', basis: 'Three-year average, FY2024-26' },
      { key: 'network', label: 'Network hospitals', value: net === null ? '—' : `${net.toLocaleString('en-IN')}+`, n: net, direction: 'higher', basis: 'Insurer websites' },
      { key: 'scale', label: 'Health premium', value: gwp === null ? '—' : crore(gwp), n: gwp, direction: 'higher', basis: 'Three-year average' },
      { key: 'solvency', label: 'Solvency ratio', value: sol === null ? '—' : sol.toFixed(2), n: sol, direction: 'higher', basis: 'FY2024-25, whole company' },
      { key: 't3m', label: sahi ? 'Claims paid within 3 months' : 'Claims paid within 3 months (all lines)', value: t3m === null ? '—' : `${t3m.toFixed(1)}%`, n: t3m, direction: 'higher', basis: 'IRDAI Handbook Table 53, FY2022-25' },
      { key: 'icr', label: 'Claims paid as % of premium', value: icr === null ? '—' : `${icr.toFixed(0)}%`, n: null, basis: 'Three-year average. Context, not a ranking' },
    ]
  }
  const g = G[slug]
  const t = MOTOR_INSURER_TERMS.find((x) => x.insurer === slug)
  const garages = t?.garages ? Math.max(...Object.values(t.garages).filter((x): x is number => typeof x === 'number')) : null
  const sol = kbValue('health', 'solvency_ratio', slug)
  const t3mM = paidWithin3Months(slug)
  return [
    { key: 'scale', label: 'Motor premium', value: g?.motor.motorTotal ? crore(g.motor.motorTotal) : '—', n: g?.motor.motorTotal ?? null, direction: 'higher', basis: 'FY2025-26, General Insurance Council' },
    { key: 'share', label: 'Share of motor market', value: g?.motorShare ? `${g.motorShare.toFixed(1)}%` : '—', n: g?.motorShare ?? null, direction: 'higher', basis: 'FY2025-26' },
    { key: 'solvency', label: 'Solvency ratio', value: sol === null ? '—' : sol.toFixed(2), n: sol, direction: 'higher', basis: 'FY2024-25, whole company' },
    { key: 't3m', label: 'Claims paid within 3 months (all lines)', value: t3mM === null ? '—' : `${t3mM.toFixed(1)}%`, n: t3mM, direction: 'higher', basis: 'IRDAI Handbook Table 53, FY2022-25. Whole company, not motor alone' },
    { key: 'garages', label: 'Cashless garages', value: garages === null ? '—' : `${garages.toLocaleString('en-IN')}+`, n: garages, direction: 'higher', basis: 'Approximate. Aggregators disagree. Check your PIN code' },
  ]
}

export interface Leaders { fact: Fact; top: { slug: string; name: string; value: string }[]; tie?: string }

export function leaders(product: Product, survivors: { slug: string; name: string }[], key: string, n = 3): Leaders | null {
  const rows = survivors.map((s) => ({ s, f: factsFor(product, s.slug).find((x) => x.key === key) })).filter((x): x is { s: { slug: string; name: string }; f: Fact } => !!x.f && x.f.n !== null)
  if (rows.length < 2) return null
  const dir = rows[0].f.direction ?? 'higher'
  rows.sort((a, b) => (dir === 'higher' ? b.f.n! - a.f.n! : a.f.n! - b.f.n!))
  const top = rows.slice(0, n).map((r) => ({ slug: r.s.slug, name: r.s.name, value: r.f.value }))
  const topVal = rows[0].f.n!
  const tied = rows.filter((r) => Math.abs(r.f.n! - topVal) < 1e-9).length
  return { fact: rows[0].f, top, tie: tied > n ? `${tied} insurers share the top value, so the order is not meaningful.` : tied > 1 && tied <= n ? `${tied} insurers share the top value.` : undefined }
}
