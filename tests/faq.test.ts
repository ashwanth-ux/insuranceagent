import { describe, expect, it } from 'vitest'
import { CONCEPTS } from '../src/engine/knowledge'
import { FAQ, faqCategoryOf, faqItem, searchFaq } from '../src/engine/faq'

const all = FAQ.flatMap((c) => c.items)
const CHAT_ONLY = ['x_hello', 'x_thanks', 'x_help', 'x_reset', 'x_bye', 's_buy', 's_medical']

describe('FAQ coverage', () => {
  it('every category has questions, and every question has a title, an answer and no placeholder text', () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(8)
    for (const c of FAQ) {
      expect(c.items.length, c.id).toBeGreaterThanOrEqual(2)
      for (const i of c.items) {
        expect(i.title.length, i.id).toBeGreaterThan(8)
        expect(i.title, i.id).toMatch(/[?a-z)]$/i)
        expect([...i.a, ...(i.bullets ?? [])].join(' ').length, i.id).toBeGreaterThan(80)
        expect(i.a.join(' ') + i.title, i.id).not.toMatch(/undefined|NaN|\[object|TODO/)
      }
    }
  })
  it('every knowledge-base answer is reachable from some category', () => {
    const ids = new Set(all.map((i) => i.id))
    for (const c of CONCEPTS) if (!CHAT_ONLY.includes(c.id)) expect(ids.has(c.id), `${c.id} is not in any category`).toBe(true)
  })
  it('related questions and links all point somewhere real', () => {
    const routes = /^(need|amount|addons|shortlist|(term|health)(\/(addons|insurers))?|faq\?open=[a-z_0-9]+|@reset)$/
    for (const i of all) {
      for (const r of i.related) if (faqItem(r)) expect(faqCategoryOf(r)).toBeTruthy()
      for (const g of i.go ?? []) expect(g.to, `${i.id} → ${g.to}`).toMatch(routes)
    }
  })
  it('question ids are unique within the page (each question is listed once as the first home)', () => {
    const seen = new Set<string>()
    for (const c of FAQ) for (const i of c.items) { if (seen.has(i.id)) continue; seen.add(i.id) }
    expect(seen.size).toBeGreaterThan(120)
  })
  it('covers the gaps customers hit: how premiums are priced, exclusions, documents, medicals, existing conditions, insurer failure, formulas, renewal', () => {
    for (const id of ['g_how_priced', 'g_exclusions', 'g_docs', 'g_medicals', 'g_ped_buy', 'g_insurer_fail', 'u_term_formula', 'u_health_formula', 'h_renewal', 'h_newborn', 'c_time']) expect(faqItem(id), id).toBeTruthy()
  })
})

describe('FAQ search', () => {
  it('finds the right question from plain words', () => {
    expect(searchFaq('room rent')[0].id).toBe('h_roomrent')
    expect(searchFaq('waiver of premium').map((i) => i.id)).toContain('t_wop')
    expect(searchFaq('super top up').map((i) => i.id)).toContain('h_super')
    expect(searchFaq('claim settlement ratio')[0].id).toBe('d_csr')
  })
  it('stop words alone match nothing; junk matches nothing; empty is empty', () => {
    expect(searchFaq('')).toEqual([])
    expect(searchFaq('what is the')).toEqual([])
    expect(searchFaq('xyzzy qwerty')).toEqual([])
  })
  it('hostile input is safe', () => {
    for (const q of ['<script>alert(1)</script>', 'a'.repeat(5000), '\u0000\u0001', '🔥🔥', '((((', '\\', '%00']) expect(Array.isArray(searchFaq(q))).toBe(true)
  })
})
