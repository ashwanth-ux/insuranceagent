import { createContext, useContext } from 'react'
import type { Product } from './state/profile'

/**
 * Two ways through the guide.
 *  - The full guide: need → amount → add-ons → insurers, with a product switch on each step.
 *  - A single product on its own (#/motor, #/health, #/term): cover → add-ons → insurers, for one product, start to finish.
 * Pages ask the flow where "next" is, so they never hard-code a route.
 */
export type Step = 'cover' | 'addons' | 'insurers'

export interface Flow {
  scoped: boolean
  product: Product | null
  /** The route for a step of a product. */
  to: (step: Step, product: Product) => string
}

const full: Flow = {
  scoped: false, product: null,
  to: (s, p) => (s === 'cover' ? `amount/${p}` : s === 'addons' ? `addons/${p}` : `shortlist/${p}`),
}

export const scopedFlow = (product: Product): Flow => ({
  scoped: true, product,
  to: (s, p) => (s === 'cover' ? p : `${p}/${s}`),
})

const Ctx = createContext<Flow>(full)
export const FlowProvider = Ctx.Provider
export const useFlow = () => useContext(Ctx)

export const PRODUCT_NAME: Record<Product, string> = { term: 'Term life', health: 'Health', motor: 'Motor' }
export const PRODUCT_TITLE: Record<Product, string> = { term: 'term life insurance', health: 'health insurance', motor: 'motor insurance' }
