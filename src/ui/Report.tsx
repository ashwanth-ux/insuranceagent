import { nextSteps, REPORT_NOTICE, type ReportSection } from '../engine/report'
import { PRODUCT_NAME, PRODUCT_TITLE } from '../flow'

const today = () => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * The report a person keeps: one section per product, built from the same cards as the insurers page, closed by what the
 * report is and is not. It reads on screen and prints to a clean PDF.
 */
export function Report({ title, sections }: { title: string; sections: ReportSection[] }) {
  const sources = [...new Set(sections.flatMap((s) => (s.nothing ? [] : [...s.sources])))]
  const live = sections.filter((s) => !s.nothing)
  return (
    <article className="report" aria-label="Your report">
      <header className="report__head">
        <p className="eyebrow">Kyfr Insurance Guide</p>
        <h2 className="report__title">{title}</h2>
        <p className="caption">Prepared {today()}</p>
        <p className="report__lead">{REPORT_NOTICE.short}</p>
      </header>

      {sections.map((s) => <Section key={s.product} s={s} single={sections.length === 1} />)}

      <section className="report__sec report__about" aria-label="About this report">
        <h3 className="report__h">{REPORT_NOTICE.headline}</h3>
        <ul className="report__points">{REPORT_NOTICE.points.map((t) => <li key={t}>{t}</li>)}</ul>
        {live.length > 0 && (
          <div className="report__src">
            <p className="eyebrow">Where the numbers come from</p>
            <ul>{sources.map((x) => <li key={x}>{x}</li>)}</ul>
            <p className="caption">Data window: {live.map((s) => `${PRODUCT_NAME[s.product]}, ${s.vintage}`).join('. ')}.</p>
          </div>
        )}
        <p className="caption">Prepared by the Kyfr Insurance Guide on {today()} from the answers you gave. If anything changes, run the guide again.</p>
      </section>
    </article>
  )
}

function Section({ s, single }: { s: ReportSection; single: boolean }) {
  const name = PRODUCT_NAME[s.product]
  if (s.nothing) {
    return (
      <section className="report__sec" aria-label={name}>
        <h3 className="report__sech">{PRODUCT_TITLE[s.product][0].toUpperCase() + PRODUCT_TITLE[s.product].slice(1)}</h3>
        <p className="report__h">Nothing to buy right now</p>
        <p className="body">We are not suggesting any {name.toLowerCase()} cover at the moment. If your situation changes, run the guide again and this updates.</p>
      </section>
    )
  }
  return (
    <section className="report__sec" aria-label={name}>
      {!single && <h3 className="report__sech">{PRODUCT_TITLE[s.product][0].toUpperCase() + PRODUCT_TITLE[s.product].slice(1)}</h3>}

      <div className="report__top">
        <div className="card report__box">
          <p className="eyebrow">Your choices</p>
          <dl className="kv">
            {s.lines.map((l) => <div className="kv__r" key={l.label}><dt className="kv__k">{l.label}</dt><dd className="kv__v">{l.value}</dd></div>)}
            <div className="kv__r"><dt className="kv__k">Add-ons</dt><dd className="kv__v">{s.picked.length ? s.picked.join(', ') : 'None'}</dd></div>
            {s.withAddons && <div className="kv__r"><dt className="kv__k">With add-ons</dt><dd className="kv__v">{s.withAddons} a year</dd></div>}
            {s.unpriced.length > 0 && <div className="kv__r"><dt className="kv__k">Priced by insurer</dt><dd className="kv__v">{s.unpriced.join(', ')}</dd></div>}
          </dl>
        </div>
        <div className="card report__box">
          <p className="eyebrow">What this is built on</p>
          <dl className="kv">
            {s.basis.map((a) => <div className="kv__r" key={a.key}><dt className="kv__k">{a.key}{a.suggested && <span className="tag tag--muted report__assumed">Assumed</span>}</dt><dd className="kv__v">{a.value}</dd></div>)}
          </dl>
        </div>
      </div>

      <div className="stack">
        <h3 className="report__h">{s.cleared} of {s.universe} insurers cleared the bar</h3>
        <p className="caption">Indicative premiums for your cover, not quotes. Listed by insurer, with the plan beneath.</p>
        <div className="report__cards">
          {s.cards.map((c) => (
            <article className="card pcard" key={c.key}>
              <div>
                <h4 className="title">{c.title}</h4>
                {c.plan && <p className="plan-sub">{c.plan}</p>}
              </div>
              <div className="pcard__p">
                <p className="pcard__big">{c.premium}</p>
                <p className="caption">{c.cover}</p>
              </div>
              <ul className="pcard__l">
                {c.lines.map((l, i) => <li key={i} data-ok={l.ok === null ? 'n' : l.ok ? 'y' : 'x'}><span aria-hidden="true">{l.ok === null ? '·' : l.ok ? '✓' : '!'}</span><span>{l.text}</span></li>)}
              </ul>
              {c.note && <p className="caption">{c.note}</p>}
            </article>
          ))}
        </div>
      </div>

      <div className="report__top">
        <div className="stack stack--sm">
          <p className="eyebrow">How we narrowed {s.universe} down to {s.cleared}</p>
          <ul className="report__tests">{s.tests.map((t) => <li key={t.title}><strong>{t.title}.</strong> {t.rule}</li>)}</ul>
        </div>
        <div className="stack stack--sm">
          <p className="eyebrow">What to do next</p>
          <ol className="report__next">{nextSteps(s).map((t) => <li key={t}>{t}</li>)}</ol>
        </div>
      </div>
    </section>
  )
}
