import type { Profile } from './state/profile'

/**
 * A host app that already knows the customer can pass what it knows in the address, and the guide starts from there:
 *   #/health?age=34&spouse=1&kids=2&city=metro&hospital=standard
 * Every value goes through the same clamping as typed input, so a bad value cannot produce a bad answer.
 * Anything passed counts as the customer's own answer, so it is not marked Suggested.
 */
export const PREFILL_KEYS = ['age', 'gender', 'smoker', 'income', 'spouse', 'spouseEarns', 'kids', 'childAge', 'parents', 'parentAge', 'city', 'hospital', 'loans', 'ownHealth', 'ownTerm', 'monthlySpend', 'savings'] as const

const n = (v: string | null): number | undefined => {
  if (v === null || v.trim() === '') return undefined
  const x = Number(v.replace(/,/g, ''))
  return Number.isFinite(x) ? x : undefined
}
const yes = (v: string | null) => v === '1' || v === 'true' || v === 'yes'

export function prefillFrom(...sources: URLSearchParams[]): Partial<Profile> | null {
  const get = (k: string) => { for (const s of sources) { const v = s.get(k); if (v !== null) return v } return null }
  const has = (k: string) => get(k) !== null
  if (!PREFILL_KEYS.some(has)) return null
  const patch: Partial<Profile> = {}
  const set = <K extends keyof Profile>(k: K, v: Profile[K] | undefined) => { if (v !== undefined) patch[k] = v }

  set('age', n(get('age')))
  const g = get('gender'); if (g === 'male' || g === 'female' || g === 'other') patch.gender = g
  if (has('smoker')) patch.smoker = yes(get('smoker'))
  set('income', n(get('income')))
  set('monthlySpend', n(get('monthlySpend')))
  set('freeSavings', n(get('savings')))

  if (['spouse', 'kids', 'parents'].some(has)) {
    const deps: Profile['dependents'] = []
    if (yes(get('spouse'))) deps.push('spouse')
    const kids = n(get('kids')) ?? 0
    if (kids > 0) { deps.push('children'); patch.kids = Math.round(kids) }
    const parents = n(get('parents')) ?? 0
    if (parents > 0) { deps.push('parents'); patch.parents = parents >= 2 ? 2 : 1 }
    patch.dependents = deps
  }
  if (has('spouseEarns')) patch.spouseEarns = yes(get('spouseEarns'))
  set('youngestChildAge', n(get('childAge')))
  set('parentAge', n(get('parentAge')))
  const city = get('city'); if (city === 'metro' || city === 'tier2' || city === 'other') patch.city = city
  const hospital = get('hospital'); if (hospital === 'top' || hospital === 'standard' || hospital === 'local') patch.hospital = hospital

  const owns: Profile['owns'] = []
  for (const l of (get('loans') ?? '').split(',')) {
    if (l === 'home') owns.push('homeLoan')
    else if (l === 'vehicle') owns.push('vehicleLoan')
    else if (l === 'other') owns.push('otherLoan')
  }
  if (has('loans')) patch.owns = owns

  const covered: Profile['covered'] = []
  const ownHealth = n(get('ownHealth')); if (ownHealth && ownHealth > 0) { covered.push('ownHealth'); patch.ownCover = ownHealth }
  const ownTerm = n(get('ownTerm')); if (ownTerm && ownTerm > 0) { covered.push('ownTerm'); patch.existingTerm = ownTerm }
  if (has('ownHealth') || has('ownTerm')) patch.covered = covered
  return patch
}
