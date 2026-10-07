// Pulls the Kyfr Insurance Check KB (IRDAI Handbook 2024-25) into a single static JSON snapshot.
// Usage: node scripts/snapshot.mjs
import { writeFileSync, mkdirSync } from 'node:fs'

const BASE = 'https://kyfr-insurance-check.cvvignesh.workers.dev/api/v1'
const get = async (path) => {
  const r = await fetch(BASE + path)
  if (!r.ok) throw new Error(`${path} -> ${r.status}`)
  return r.json()
}

const out = { source: 'IRDAI Handbook on Indian Insurance Statistics 2024-25 via Kyfr Insurance Check API', fetchedAt: new Date().toISOString(), types: {} }

for (const type of ['life', 'health']) {
  const [{ insurers }, { metrics }] = await Promise.all([get(`/insurers?type=${type}`), get(`/metrics?type=${type}`)])
  const t = { insurers, metrics: {}, periods: [] }
  for (const m of metrics) {
    const first = await get(`/metric/${m.code}?type=${type}`)
    t.periods = first.available_periods
    const byPeriod = {}
    for (const period of first.available_periods) {
      const d = period === first.period ? first : await get(`/metric/${m.code}?type=${type}&period=${period}`)
      byPeriod[period] = {}
      for (const v of d.values) {
        const f = v.fact
        byPeriod[period][v.insurer.slug] = f.available
          ? { v: f.value, raw: (f.raw_inputs || []).map((r) => [r.label, r.value]) }
          : null
      }
    }
    t.metrics[m.code] = {
      code: m.code,
      name: m.name,
      label: m.label,
      plain: m.plain_meaning,
      keepInMind: m.keep_in_mind,
      format: m.unit_format,
      derivation: m.derivation,
      table: m.source?.table,
      companyWide: m.company_wide,
      byPeriod,
    }
  }
  out.types[type] = t
}

mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true })
writeFileSync(new URL('../src/data/kb.json', import.meta.url), JSON.stringify(out))
console.log('kb.json written', Object.keys(out.types).map((k) => `${k}:${Object.keys(out.types[k].metrics).length} metrics`).join(' '))
