import type { ReactNode } from 'react'
import { PRODUCT_TITLE, useFlow } from '../flow'
import { StepBar } from './primitives'

export function PageHead({ step, go, eyebrow, title, sub }: { step?: 1 | 2 | 3 | 4; go: (to: string) => void; eyebrow?: string; title: string; sub?: ReactNode }) {
  const flow = useFlow()
  const to = ['need', 'amount', 'addons', 'shortlist']
  const scopedTo = ['cover', 'addons', 'insurers'] as const
  // On a product's own flow the step bar already says which step this is, so the heading is the product itself.
  const scoped = flow.scoped && flow.product && step && step > 1
  const heading = scoped ? PRODUCT_TITLE[flow.product!].replace(/^./, (c) => c.toUpperCase()) : title
  const label = scoped ? undefined : eyebrow
  return (
    <header className="phead">
      {step && (flow.scoped && flow.product && step > 1
        ? <StepBar items={['Cover', 'Add-ons', 'Insurers']} current={step - 1} onGo={(n) => go(flow.to(scopedTo[n - 1], flow.product!))} />
        : <StepBar items={['Need', 'Cover', 'Add-ons', 'Insurers']} current={step} onGo={(n) => go(to[n - 1])} />)}
      <div className="phead__t">
        {label && <p className="eyebrow">{label}</p>}
        <h1 className="h1">{heading}</h1>
        {sub && <p className="body">{sub}</p>}
      </div>
    </header>
  )
}
