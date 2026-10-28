import { useEffect, useMemo } from 'react'
import { emit } from '../bridge'
import { sectionFor, reportProducts } from '../engine/report'
import { nothingToBuy, outcomeFor } from '../engine/selection'
import { PRODUCT_NAME, PRODUCT_TITLE, useFlow } from '../flow'
import { useProfile, type Product } from '../state/profile'
import { Arrow } from '../ui/primitives'
import { Report } from '../ui/Report'

const ALL: Product[] = ['term', 'health', 'motor']

/** The last page of a flow: it says plainly that the person is finished, and hands them the report as a PDF. */
export default function Done({ go, product }: { go: (to: string) => void; product?: string }) {
  const { p } = useProfile()
  const flow = useFlow()
  const tab: Product = product === 'term' || product === 'health' || product === 'motor' ? product : 'term'
  const nothing = nothingToBuy(tab, p)
  const out = useMemo(() => outcomeFor(tab, p), [tab, p])
  const products = useMemo(() => reportProducts(flow.scoped, tab, p), [flow.scoped, tab, p])
  const sections = useMemo(() => products.map((x) => sectionFor(x, p)), [products, p])
  const everyNothing = sections.every((s) => s.nothing)
  const title = flow.scoped ? `Your ${PRODUCT_TITLE[tab]} report` : 'Your insurance guide report'

  // Tells a host app (WebView or parent page) that this flow has finished, so it can close the browser for the person.
  useEffect(() => {
    emit({ type: 'done', product: tab, lines: nothing ? [] : out.lines, premium: nothing ? null : { low: out.total.low, high: out.total.high }, addons: nothing ? [] : out.picked })
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const scope = flow.scoped ? `That’s everything for your ${PRODUCT_TITLE[tab]}.` : 'That’s everything we have for you.'
  const others = flow.scoped ? ALL.filter((x) => x !== tab) : []

  return (
    <div className="shell shell--wide page done">
      <div className="done__hero no-print">
        <span className="done__tick" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <h1 className="h1">You’re all set.</h1>
        <p className="body">{scope} {everyNothing ? 'There is nothing to buy right now, and the report below says so.' : 'Save your report as a PDF, and you can close this page.'}</p>
        <div className="done__actions">
          <button type="button" className="btn btn--brand" onClick={() => window.print()}>Save as PDF</button>
          <p className="caption">Choose “Save as PDF” as the destination in the window that opens.</p>
        </div>
      </div>

      <Report title={title} sections={sections} />

      <section className="stack no-print" aria-label="Check something else">
        {others.length > 0 && (
          <>
            <p className="eyebrow">Want to check something else?</p>
            <div className="done__alt">
              {others.map((x) => (
                <button type="button" className="btn" key={x} onClick={() => go(flow.to('cover', x))}>{PRODUCT_NAME[x]} <Arrow /></button>
              ))}
            </div>
          </>
        )}
        <p><button type="button" className="linkbtn" onClick={() => go(flow.to('insurers', tab))}>Back to the insurers</button></p>
      </section>
    </div>
  )
}
