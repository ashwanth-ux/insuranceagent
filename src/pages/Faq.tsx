import { useEffect, useMemo, useRef, useState } from 'react'
import { FAQ, faqCategoryOf, faqItem, searchFaq, type FaqItem } from '../engine/faq'
import { PRODUCT_TITLE } from '../flow'
import { useProfile } from '../state/profile'
import { Arrow, Chevron } from '../ui/primitives'

export default function Faq({ go, open: openParam, q: qParam }: { go: (to: string) => void; open: string; q: string }) {
  const { reset } = useProfile()
  const initial = faqCategoryOf(openParam) ?? FAQ[0].id
  const [cat, setCat] = useState(initial)
  const [query, setQuery] = useState(qParam.slice(0, 120))
  const [openId, setOpenId] = useState<string | null>(faqItem(openParam) ? openParam : null)
  const [cleared, setCleared] = useState(false)
  const listTop = useRef<HTMLDivElement>(null)

  // A link into the FAQ (from a result page or the landing page) opens that question.
  useEffect(() => {
    const c = faqCategoryOf(openParam)
    if (c) { setCat(c); setQuery(''); setOpenId(openParam) }
  }, [openParam])
  useEffect(() => { if (qParam) setQuery(qParam.slice(0, 120)) }, [qParam])
  useEffect(() => {
    if (!openId) return
    const el = document.getElementById(`faq-${openId}`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [openId, cat])

  const hits = useMemo(() => (query.trim() ? searchFaq(query) : null), [query])
  const current = FAQ.find((c) => c.id === cat) ?? FAQ[0]

  const jump = (id: string) => {
    const c = faqCategoryOf(id)
    if (!c) return
    setQuery('')
    setCat(c)
    setOpenId(id)
  }
  const act = (to: string) => {
    if (to === '@reset') { reset(); setCleared(true); return }
    go(to)
  }

  const row = (item: FaqItem) => {
    const isOpen = openId === item.id
    const related = item.related.map((id) => faqItem(id)).filter((x): x is FaqItem => !!x)
    return (
      <li className="faqi" data-open={isOpen} key={item.id} id={`faq-${item.id}`}>
        <h3 className="faqi__h">
          <button type="button" className="faqi__b" aria-expanded={isOpen} aria-controls={`faq-a-${item.id}`} onClick={() => setOpenId(isOpen ? null : item.id)}>
            <span>{item.title}</span><Chevron />
          </button>
        </h3>
        {isOpen && (
          <div className="faqi__a" id={`faq-a-${item.id}`}>
            {item.a.map((t, i) => <p key={i}>{t}</p>)}
            {item.bullets && <ul>{item.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
            {(() => {
              // Every product answer can take the customer straight into that product's own flow.
              const acts = [...(item.go ?? [])]
              if (item.product && !acts.some((g) => g.to === item.product || g.to.startsWith(`${item.product}/`))) acts.push({ label: `Check my ${PRODUCT_TITLE[item.product]}`, to: item.product })
              return acts.length > 0 && (
                <div className="row" style={{ gap: 10 }}>
                  {acts.map((g, i) => <button key={g.label} type="button" className={i === 0 ? 'btn btn--brand btn--small' : 'btn btn--small'} onClick={() => act(g.to)}>{g.label} {i === 0 && <Arrow />}</button>)}
                </div>
              )
            })()}
            {item.id === 'u_reset' && cleared && <p className="caption" role="status">Done. Your answers have been cleared from this browser.</p>}
            {related.length > 0 && (
              <div className="stack stack--sm">
                <p className="eyebrow">Related</p>
                <div className="sugg">{related.map((r) => <button key={r.id} type="button" className="chip chip--soft" onClick={() => jump(r.id)}>{r.title}</button>)}</div>
              </div>
            )}
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="shell shell--wide page">
      <header className="stack" style={{ marginBottom: 24 }}>
        <h1 className="h1">FAQ</h1>
        <div className="faqs">
          <label className="sr" htmlFor="faq-search">Search the questions</label>
          <input id="faq-search" className="input" type="search" value={query} maxLength={120} autoComplete="off" onChange={(e) => setQuery(e.target.value)} placeholder="Search, e.g. room rent" />
        </div>
      </header>

      <div className="faq">
        <nav className="faq__nav" aria-label="Topics">
          {FAQ.map((c) => (
            <button key={c.id} type="button" className="faq__t" aria-current={!hits && c.id === cat ? 'true' : undefined} onClick={() => { setQuery(''); setCat(c.id); setOpenId(null) }}>
              <span>{c.title}</span><span className="faq__n">{c.items.length}</span>
            </button>
          ))}
        </nav>

        <div ref={listTop} className="stack">
          {hits ? (
            <>
              <p className="caption" role="status">{hits.length === 0 ? 'No question matches that.' : `${hits.length} ${hits.length === 1 ? 'question' : 'questions'} match “${query.trim()}”.`}</p>
              {hits.length === 0 && <p className="body small">Try one or two plain words, or pick a topic on the left.</p>}
              <ul className="faql">{hits.map(row)}</ul>
            </>
          ) : (
            <>
              <div className="stack stack--sm">
                <h2 className="title">{current.title}</h2>
                <p className="body small">{current.blurb}</p>
                {current.product && <div><button type="button" className="btn btn--small" onClick={() => go(current.product!)}>Check my {PRODUCT_TITLE[current.product]} <Arrow /></button></div>}
              </div>
              <ul className="faql">{current.items.map(row)}</ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
