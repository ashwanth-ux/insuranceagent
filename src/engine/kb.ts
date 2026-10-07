import raw from '../data/kb.json'

export type KbType = 'life' | 'health'

export interface Insurer {
  slug: string
  name: string
  legal_name: string
  kind: 'life' | 'standalone_health' | 'general' | 'specialised'
  note: string | null
  consumer_listed: boolean
}

interface Entry {
  v: number
  raw: [string, number][]
}

interface MetricDef {
  code: string
  name: string
  label: string
  plain: string
  keepInMind: string[]
  format: string
  derivation: string
  table: string
  companyWide: boolean
  byPeriod: Record<string, Record<string, Entry | null>>
}

interface TypeBlock {
  insurers: Insurer[]
  periods: string[]
  metrics: Record<string, MetricDef>
}

const KB = raw as unknown as { source: string; fetchedAt: string; types: Record<KbType, TypeBlock> }

export const kbSource = KB.source
export const kbFetchedAt = KB.fetchedAt
export const insurers = (t: KbType): Insurer[] => KB.types[t].insurers
export const periods = (t: KbType): string[] => KB.types[t].periods
export const latest = (t: KbType): string => periods(t)[periods(t).length - 1]
export const previous = (t: KbType): string => periods(t)[periods(t).length - 2]
export const metricDef = (t: KbType, code: string): MetricDef => KB.types[t].metrics[code]

export const entry = (t: KbType, code: string, slug: string, period = latest(t)): Entry | null => KB.types[t].metrics[code]?.byPeriod[period]?.[slug] ?? null

export const value = (t: KbType, code: string, slug: string, period = latest(t)): number | null => entry(t, code, slug, period)?.v ?? null

export function rawValue(t: KbType, code: string, slug: string, label: string, period = latest(t)): number | null {
  const e = entry(t, code, slug, period)
  const hit = e?.raw.find(([l]) => l === label)
  return hit ? hit[1] : null
}

export const insurerBySlug = (t: KbType, slug: string) => insurers(t).find((i) => i.slug === slug)

export const fyLabel = (p: string) => p.replace('FY20', 'FY').replace('-', '–')
