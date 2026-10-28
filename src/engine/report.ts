import { assumptionsFor, type Assumption } from './assumptions'
import { funnelFor } from './funnel'
import { buildCards, type Card } from './planCards'
import { nothingToBuy, rangeText } from './selection'
import type { Product, Profile } from '../state/profile'

export interface ReportSection {
  product: Product
  nothing: boolean
  /** The cover we suggest, one line per cover. */
  lines: { label: string; value: string }[]
  /** Add-ons that are switched on, by name. */
  picked: string[]
  /** Yearly cost with the add-ons, only when an add-on has a price we can stand behind. */
  withAddons?: string
  /** Switched-on add-ons that only the insurer can price. */
  unpriced: string[]
  /** What the suggestion was built on. */
  basis: Assumption[]
  cards: Card[]
  universe: number
  cleared: number
  /** How the list was cut down: each test, in order. */
  tests: { title: string; rule: string }[]
  sources: readonly string[]
  vintage: string
}

const ORDER: Product[] = ['term', 'health', 'motor']

/**
 * Which products the report covers. A single-product journey reports on that product. The full guide reports on everything it
 * suggests for the person: life and health always, motor only when they told us they have a vehicle.
 */
export function reportProducts(scoped: boolean, product: Product, p: Profile): Product[] {
  if (scoped) return [product]
  const hasVehicle = p.owns.includes('car') || p.owns.includes('bike')
  return ORDER.filter((x) => x !== 'motor' || hasVehicle || x === product)
}

const NEXT: Record<Product, (s: ReportSection) => string[]> = {
  term: (s) => [
    `Ask two or three of these insurers for a quote on ${s.lines[0]?.value ?? 'the cover above'} to the same age, with the same add-ons, so the prices can be compared.`,
    'Answer the health, habits and income questions on the proposal form fully and exactly. A claim can be refused later if something material was left out.',
    'Keep the policy document and your nominee’s details somewhere your family can find them.',
  ],
  health: () => [
    'Ask two or three of these insurers for a quote on identical terms: same cover, same room-rent rule, same city, same family members.',
    'Check the waiting periods for existing conditions and for specific illnesses, and the cashless hospitals near you.',
    'Read the policy wording before you pay, and tell the insurer about any existing condition on the proposal form.',
  ],
  motor: () => [
    'Ask two or three of these insurers for a quote on the same insured value and the same add-ons.',
    'Enter your home PIN code on each insurer’s website and count the cashless garages within 5 km. Then your office PIN code.',
    'Read the add-on terms before you pay, especially claim limits on zero depreciation.',
  ],
}
export const nextSteps = (s: ReportSection): string[] => NEXT[s.product](s)

export function sectionFor(product: Product, p: Profile): ReportSection {
  const f = funnelFor(product)
  const nothing = nothingToBuy(product, p)
  const { cards, out } = buildCards(product, p, f)
  return {
    product, nothing,
    lines: nothing ? [] : out.lines,
    picked: nothing ? [] : out.picked,
    withAddons: !nothing && out.extras.high > 0 ? rangeText(out.total) : undefined,
    unpriced: nothing ? [] : out.unpriced,
    basis: assumptionsFor(product, p),
    cards: nothing ? [] : cards,
    universe: f.universe,
    cleared: f.survivors.length,
    tests: f.steps.map((s) => ({ title: s.step.title, rule: s.step.rule })),
    sources: f.sources,
    vintage: f.vintage,
  }
}

/** The boilerplate that closes the report: what it is, and what it is not. */
export const REPORT_NOTICE = {
  headline: 'A directional guide, not advice or a quote',
  short: 'This report is directional. Treat the figures as a starting point for talking to insurers, not as final numbers.',
  points: [
    'Directional, not literal. Every figure is a range worked out from the answers you gave and the assumptions marked “assumed”. Real numbers will differ.',
    'Not a quote or an offer. The insurer decides the premium, the terms and whether to accept you, after it has your full details.',
    'Not financial, tax or legal advice. For a decision this large, talk to a licensed insurance adviser as well.',
    'Past record, not a promise. An insurer’s claims history describes how it has behaved, not whether your own claim will be paid.',
    'Details change. Plan features and prices come from public sources. Read the policy wording before you buy.',
  ],
} as const
