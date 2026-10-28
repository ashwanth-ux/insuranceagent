import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : [] })
const SRC = files(new URL('../src', import.meta.url).pathname)

// Things people read must never speak bluntly about their own death. Official names that people need in order
// to match a quote or a document are kept, and nothing else: search phrases people type are not shown to anyone.
const ALLOWED = [/accidental death benefit/gi, /death certificate/gi, /accidentalDeath/g]
const NEVER = /\b(die|died|dies|dying|suicide|outlive[sd]?|still alive|mortality|passed away|widow(ed|s)?)\b/i
const isComment = (l: string) => /^\s*(\/\/|\/\*\*|\*)/.test(l)
const isSearchPhrases = (l: string) => /^\s*c\(['"]/.test(l)

describe('the wording around death', () => {
  const lines = SRC.filter((f) => !f.endsWith('knowledgeBoost.ts')).flatMap((f) =>
    readFileSync(f, 'utf8').split('\n').map((text, i) => ({ f: f.split('/src/')[1], n: i + 1, text })).filter((x) => !isComment(x.text) && !isSearchPhrases(x.text)))

  it('never says "you die", "if you died", "suicide", "outlive" or similar to the person reading', () => {
    const bad = lines.filter((l) => NEVER.test(l.text))
    expect(bad.map((l) => `${l.f}:${l.n}  ${l.text.trim().slice(0, 120)}`)).toEqual([])
  })
  it('uses the word "death" only inside an official name', () => {
    const bad = lines.filter((l) => /\bdeath\b/i.test(ALLOWED.reduce((t, a) => t.replace(a, ''), l.text)))
    expect(bad.map((l) => `${l.f}:${l.n}  ${l.text.trim().slice(0, 120)}`)).toEqual([])
  })
  it('reframes the loans question, the one this started with', () => {
    const need = readFileSync(new URL('../src/pages/Need.tsx', import.meta.url), 'utf8')
    expect(need).toContain('If something happened to you, your family would be left to repay it.')
    expect(need).not.toMatch(/If you died/)
  })
})
