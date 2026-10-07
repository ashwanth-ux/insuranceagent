import raw from '../data/irdai-handbook.json'
import { value as kbValue } from './kb'

interface T18 { within30Num: number | null; totalNum: number; pct30Num: number | null }
interface T53 { paid: number | null; repudiated: number | null; intimated: number | null; lt3m: number | null; paidShareOfDecided: number | null }
const H = raw as unknown as { source: string; table10: Record<string, Record<string, number>>; table18: Record<string, Record<string, T18>>; table53: Record<string, Record<string, T53>> }

export const handbookSource = H.source
export const YEARS3 = ['2022-23', '2023-24', '2024-25'] as const
export const LATEST = '2024-25'

/** Life: share of individual death claims settled within 30 days of intimation, weighted by claims, over the last three years. */
export function life30Day(slug: string, years: readonly string[] = YEARS3): number | null {
  let w = 0, t = 0
  for (const y of years) {
    const r = H.table18[slug]?.[y]
    if (r && r.within30Num !== null && r.totalNum > 0) { w += r.within30Num; t += r.totalNum }
  }
  return t > 0 ? (100 * w) / t : null
}
export const life30DayLatest = (slug: string) => H.table18[slug]?.[LATEST]?.pct30Num ?? null

/** Individual policies in force at the end of the year (count). */
export const inForcePolicies = (slug: string, year = LATEST): number | null => {
  const v = H.table10[slug]?.[year]
  return v === undefined ? null : v * 1000
}

/** Life complaints per 10,000 policies in force: grievances reported (Table 37) ÷ individual policies in force (Table 10). */
export function lifeComplaintsPer10kPolicies(slug: string): number | null {
  const g = kbValue('life', 'grievances_reported', slug)
  const p = inForcePolicies(slug)
  return g !== null && p !== null && p >= 50_000 ? (g / p) * 10_000 : null
}

/** General and health insurers (Table 53). Whole-company, all lines of business. Weighted by claims paid. */
export function paidWithin3Months(slug: string, years: readonly string[] = YEARS3): number | null {
  let w = 0, t = 0
  for (const y of years) {
    const r = H.table53[slug]?.[y]
    if (r && r.lt3m !== null && r.paid) { w += (r.lt3m / 100) * r.paid; t += r.paid }
  }
  return t > 0 ? (100 * w) / t : null
}
export function paidShareOfDecided(slug: string, years: readonly string[] = YEARS3): number | null {
  let p = 0, d = 0
  for (const y of years) {
    const r = H.table53[slug]?.[y]
    if (r && r.paid !== null && r.repudiated !== null) { p += r.paid; d += r.paid + r.repudiated }
  }
  return d > 0 ? (100 * p) / d : null
}
export const claimsIntimated = (slug: string, year = LATEST) => H.table53[slug]?.[year]?.intimated ?? null
