import { useMemo } from 'react'
import { HEALTH_PLANS, SOURCES, TERM_PLANS, type HealthPlan, type TermPlan } from '../data/plans'
import { termAddons } from '../engine/addons'
import { CRORE, inrFull } from '../engine/format'
import { funnelFor, type Candidate, type Funnel } from '../engine/funnel'
import { factsFor, leaders } from '../engine/insurerFacts'
import { insurerBySlug } from '../engine/kb'
import { buildCards } from '../engine/planCards'
import { pendingFor, type Priority } from '../engine/shortlist'
import { computeTerm } from '../engine/term'
import { planPremium } from '../engine/termplans'
import { effectiveSpend, kidsOf, monthlyEmi, termInputOf } from '../state/derive'
import { useProfile, type Product } from '../state/profile'
import { PRODUCT_NAME, useFlow } from '../flow'
import { NothingToBuy } from '../ui/Impacts'
import { nothingToBuy } from '../engine/selection'
import { PageHead } from '../ui/Page'
import { Arrow, Disclose, Seg } from '../ui/primitives'

const TABS = [{ id: 'term', label: 'Term life' }, { id: 'health', label: 'Health' }] as const

const MEASURES: Record<Product, { key: string; q: string; priority: Priority }[]> = {
  term: [
    { key: 'asr', q: 'Who pays the money?', priority: 'certainty' }, { key: 'csr', q: 'Who pays the most claims?', priority: 'certainty' },
    { key: 'd30', q: 'Who pays fastest?', priority: 'service' }, { key: 'complaints', q: 'Who gets complained about least?', priority: 'service' }, { key: 'solvency', q: 'Who has the biggest cushion?', priority: 'strength' },
  ],
  health: [
    { key: 'csr', q: 'Who settles the most claims?', priority: 'certainty' }, { key: 'complaints', q: 'Who gets complained about least?', priority: 'service' },
    { key: 'network', q: 'Who has the widest cashless network?', priority: 'service' }, { key: 't3m', q: 'Who pays fastest?', priority: 'service' }, { key: 'solvency', q: 'Who has the biggest cushion?', priority: 'strength' }, { key: 'scale', q: 'Who is the biggest?', priority: 'strength' },
  ],
}

const ORDER: Record<Priority, Priority[]> = { certainty: ['certainty', 'strength', 'service'], strength: ['strength', 'certainty', 'service'], service: ['service', 'certainty', 'strength'] }

export default function Shortlist({ go, product }: { go: (to: string) => void; product?: string }) {
  const { p, set } = useProfile()
  const flow = useFlow()
  const tab: Product = product === 'term' || product === 'health' ? product : 'term'
  const nothing = nothingToBuy(tab, p)
  const f = useMemo(() => funnelFor(tab), [tab])
  const survivors = f.survivors.map((c) => ({ slug: c.slug, name: c.name }))
  const order = ORDER[p.priority]
  const measures = [...MEASURES[tab]].sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority))
  const pending = pendingFor(tab)
  const stage = (n: number) => String(n)

  return (
    <div className="shell shell--wide page flow">
      <PageHead step={flow.scoped && nothing ? undefined : 4} go={go} title="Insurers" />
      {!flow.scoped && (
        <div style={{ marginBottom: 16 }} className="stack">
          <Seg<Product> label="Product" block value={tab} onChange={(v) => go(`shortlist/${v}`)} options={TABS.map((t) => ({ id: t.id, label: t.label }))} />
        </div>
      )}

      {nothing ? <NothingToBuy product={PRODUCT_NAME[tab].toLowerCase()} onBack={() => go(flow.to('cover', tab))} onElse={() => go(flow.scoped ? '' : 'need')} onDone={() => go(flow.to('done', tab))} /> : (
      <div className="stack stack--lg">
        <Recommended tab={tab} f={f} />

        <section className="stack" aria-label="Leaders on each measure">
          <div className="lead-h">
            <h2 className="h2">Who leads</h2>
            <Seg<Priority> label="Lead with" value={p.priority} onChange={(priority) => set({ priority })} options={[{ id: 'certainty', label: 'Claims' }, { id: 'strength', label: 'Strength' }, { id: 'service', label: 'Service' }]} />
          </div>
          <div className="lead-scroll">
            {measures.map((m) => {
              const l = leaders(tab, survivors, m.key)
              if (!l) return null
              return (
                <div className="card lead-card" key={m.key}>
                  <p className="eyebrow">{m.q}</p>
                  <h3 className="title" style={{ marginBottom: 4 }}>{l.fact.label}</h3>
                  <div>{l.top.map((t, i) => (
                    <div className="leader" key={t.slug}><span className="leader__r" aria-hidden="true">{i + 1}</span><span><span className="leader__n" style={{ display: 'block' }}>{t.name}</span></span><span className="leader__v num">{t.value}</span></div>
                  ))}</div>
                  {l.tie && <p className="caption" style={{ marginTop: 8 }}>{l.tie}</p>}
                </div>
              )
            })}
          </div>
          <p className="caption">Top three on each measure among those that cleared the bar. Leading on one is not winning overall.</p>
        </section>

        <div className="card" style={{ padding: '0 20px' }}>
          <Disclose bare title={`How we filtered ${f.universe} down to ${f.survivors.length}`}><FunnelView f={f} stage={stage} /></Disclose>
          <Disclose title="Each insurer in detail"><div className="grid-2" style={{ paddingBottom: 12 }}>{[...f.survivors].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <Survivor key={c.slug} product={tab} c={c} />)}</div></Disclose>
          <Disclose title="Plans to look at">
            <div className="stack stack--lg" style={{ paddingBottom: 12 }}>
              {tab === 'term' && <TermPlans f={f} />}
              {tab === 'health' && <HealthPlansView f={f} />}
            </div>
          </Disclose>
        </div>

        <div className="card" style={{ padding: '0 20px' }}>
          <Disclose bare title="All insurers, every test">
            <AllTable f={f} />
          </Disclose>
          <Disclose title="What this can and cannot tell you">
            <ul className="stack--sm stack body small" style={{ paddingLeft: 18, listStyle: 'disc' }}>
              <li>It describes an insurer’s past record, not the chance that your own claim is paid.</li>
              {f.caveats.map((c) => <li key={c}>{c}</li>)}
              <li>Plan details come from public sources and change. Read the policy wording before you buy.</li>
            </ul>
            {(f.pending.length > 0 || pending.length > 0) && (
              <>
                <p className="eyebrow">What we cannot judge yet</p>
                <ul className="stack--sm stack body small" style={{ paddingLeft: 18, listStyle: 'disc' }}>
                  {f.pending.map((x) => <li key={x}>{x}</li>)}
                  {pending.map((x) => <li key={x.id}>{x.title}: needs {x.needs.toLowerCase()}.</li>)}
                </ul>
              </>
            )}
            <p className="eyebrow">Sources</p>
            <ul className="stack--sm stack caption" style={{ paddingLeft: 18, listStyle: 'disc' }}>{f.sources.map((s) => <li key={s}>{s}</li>)}</ul>
            <p className="caption">Data window: {f.vintage}.</p>
          </Disclose>
        </div>
        <div className="endbar">
          <button type="button" className="btn" onClick={() => go(flow.to('addons', tab))}>Back to add-ons</button>
          <button type="button" className="btn btn--brand" onClick={() => go(flow.to('done', tab))}>Finish <Arrow /></button>
        </div>
      </div>
      )}
    </div>
  )
}

/* ───────────────────────── Funnel ───────────────────────── */
function FunnelView({ f, stage }: { f: Funnel; stage: (n: number) => string }) {
  return (
    <section className="stack" aria-label="How the shortlist was built">
      <h2 className="h2">{f.universe} {f.title.toLowerCase()}, filtered in {f.steps.length} steps</h2>
      <div className="card">
        <div className="funnel">
          {f.steps.map((s, i) => (
            <div className="fstep" key={s.step.id}>
              <span className="fstep__n" aria-hidden="true">{stage(s.passed.length)}</span>
              <div>
                <p className="eyebrow">Step {i + 1} · {s.step.kind === 'check' ? 'Check' : s.step.kind === 'gate' ? 'Gate' : 'Filter'}</p>
                <p className="fstep__t">{s.step.title}</p>
                <p className="fstep__r">{s.step.rule}</p>
                <p className="fstep__c">{s.eliminated.length === 0 ? `All ${s.entering} passed` : `${s.entering} in, ${s.passed.length} through`}</p>
                <Disclose bare title={s.eliminated.length ? `Who was cut, and why (${s.eliminated.length})` : 'Why this bar'}>
                  {s.eliminated.length > 0 && (
                    <div className="out">{s.eliminated.map((e) => <div className="out__r" key={e.slug}><span className="out__n">{e.name}</span><span className="out__w">{e.reason}</span></div>)}</div>
                  )}
                  <p className="caption">{s.step.basis}</p>
                  <p className="caption">Source: {s.step.source}</p>
                </Disclose>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── Survivor card ───────────────────────── */
function Survivor({ product, c }: { product: Product; c: Candidate }) {
  const facts = factsFor(product, c.slug).slice(0, 5)
  return (
    <div className="card">
      <div className="row row--between" style={{ marginBottom: 8 }}>
        <h3 className="title">{c.name}</h3>
        <span className="tag tag--ok">Cleared all</span>
      </div>
      <dl className="kv">
        {facts.map((x) => <div className="kv__r" key={x.key}><dt className="kv__k">{x.label}</dt><dd className="kv__v">{x.value}</dd></div>)}
      </dl>
    </div>
  )
}

/* ───────────────────────── All insurers table ───────────────────────── */
function AllTable({ f }: { f: Funnel }) {
  const rows = [...f.table].sort((a, b) => Number(b.slug in Object.fromEntries(f.survivors.map((s) => [s.slug, 1]))) - Number(a.slug in Object.fromEntries(f.survivors.map((s) => [s.slug, 1]))) || a.name.localeCompare(b.name))
  const surv = new Set(f.survivors.map((s) => s.slug))
  return (
    <>
      <p className="body small">A ✓ means the insurer passed that test. A ✗ shows the value that failed.</p>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Insurer</th>{f.steps.map((s) => <th key={s.step.id}>{s.step.title}</th>)}</tr></thead>
        <tbody>{rows.map((c) => (
          <tr key={c.slug} data-hl={surv.has(c.slug)}>
            <td>{c.name}</td>
            {f.steps.map((s) => { const o = c.outcomes[s.step.id]; return <td key={s.step.id} style={{ color: o?.pass ? '#6ff0a0' : 'var(--ink-muted)' }}>{o?.pass ? '✓' : '✗'} <span className="caption">{o?.display}</span></td> })}
          </tr>))}</tbody>
      </table></div>
    </>
  )
}

/* ───────────────────────── TERM plans ───────────────────────── */
function TermPlans({ f }: { f: Funnel }) {
  const { p } = useProfile()
  const input = termInputOf(p)
  const t = computeTerm(input)
  const cover = t.recommended > 0 ? t.recommended : CRORE
  const addons = termAddons({ depends: p.dependents.length > 0, spouseEarns: p.dependents.includes('spouse') && p.spouseEarns, hasKids: kidsOf(p) > 0, age: p.age, monthlySpend: effectiveSpend(p), monthlyEmi: monthlyEmi(p), freeSavings: p.freeSavings, heavyCommute: p.heavyCommute, familyHistory: p.familyHistory, spouseManagesLumpSum: p.lumpSum, recommendedCover: t.recommended, existingCover: input.existingTerm })
  const needCi = addons.find((a) => a.id === 'ci')?.verdict === 'take'
  const needWop = addons.find((a) => a.id === 'wop')?.verdict === 'take'
  const surv = new Set(f.survivors.map((s) => s.slug))
  const plans = TERM_PLANS.filter((pl) => surv.has(pl.insurer))
  const others = TERM_PLANS.filter((pl) => !surv.has(pl.insurer))
  const cur = (pl: TermPlan) => planPremium(pl, { age: p.age, gender: p.gender, smoker: p.smoker, cover, coverToAge: t.coverToAge })

  return (
    <section className="stack" aria-label="Plans from insurers that cleared the bar">
      <h2 className="h2">Plans to look at</h2>
      <p className="body small">Insurers set the track record. Plans set what you actually get. Premiums are indicative for {inrFull(cover)} to age {t.coverToAge}, scaled by each plan’s real relative price.</p>
      <div className="grid-2">{plans.map((pl) => <TermPlanCard key={pl.id} pl={pl} price={cur(pl)} needCi={needCi} needWop={needWop} />)}</div>
      {others.length > 0 && (
        <div className="card" style={{ padding: '0 20px' }}>
          <Disclose bare title={`${others.length} other widely compared plans that did not clear every bar`}>
            <div className="out">{others.map((pl) => <div className="out__r" key={pl.id}><span className="out__n">{insurerBySlug('life', pl.insurer)?.name} · {pl.name}</span><span className="out__w">{f.table.find((c) => c.slug === pl.insurer)?.outcomes && Object.entries(f.table.find((c) => c.slug === pl.insurer)!.outcomes).filter(([, o]) => !o.pass).map(([, o]) => o.reason)[0]}</span></div>)}</div>
          </Disclose>
        </div>
      )}
      <p className="caption">{SOURCES.dittoTerm.note} {SOURCES.pranay.note}</p>
    </section>
  )
}

function TermPlanCard({ pl, price, needCi, needWop }: { pl: TermPlan; price: { low: number; high: number }; needCi: boolean; needWop: boolean }) {
  const wopLabel = !pl.wop.offered ? 'No waiver of premium' : pl.wop.trigger === 'ci+disability' ? 'Waiver on illness and disability' : pl.wop.trigger === 'terminal' ? 'Waiver on terminal illness only' : 'Waiver on disability'
  const wopOk = pl.wop.offered && pl.wop.trigger === 'ci+disability'
  const ciLabel = !pl.ci.offered ? 'No critical illness cover' : `${pl.ci.type === 'accelerated' ? 'Accelerated' : 'Optional'} critical illness${pl.ci.illnesses ? `, ${pl.ci.illnesses} illnesses` : ''}`
  const ciOk = pl.ci.offered && pl.ci.type !== 'accelerated'
  return (
    <div className="card stack">
      <div>
        <h3 className="title">{insurerBySlug('life', pl.insurer)?.name}</h3>
        <p className="plan-sub">{pl.name}</p>
      </div>
      <p className="h2 num">{inrFull(price.low)} <span className="muted" style={{ fontSize: 16 }}>to</span> {inrFull(price.high)} <span className="muted" style={{ fontSize: 14, fontWeight: 600 }}>a year</span></p>
      <ul className="stack--sm stack small" style={{ fontWeight: 600 }}>
        <Fit ok={ciOk} need={needCi} text={ciLabel} />
        <Fit ok={wopOk} need={needWop} text={wopLabel} />
        <li className="muted" style={{ fontWeight: 500 }}>{pl.premiumBreak ? 'Premium break: defer a year, repay later' : pl.lifeStage ? 'Life-stage cover increases' : pl.highlights[0]}</li>
      </ul>
      <Disclose bare title="What to know">
        <ul className="stack--sm stack small body" style={{ paddingLeft: 18, listStyle: 'disc' }}>
          {pl.highlights.map((h) => <li key={h}>{h}</li>)}
          {pl.ci.note && <li>{pl.ci.note}</li>}
          {pl.wop.note && <li>{pl.wop.note}</li>}
          {pl.terminal.note && <li>{pl.terminal.note}</li>}
          {pl.advancePayout && <li>{pl.advancePayout}</li>}
        </ul>
        {pl.watch.length > 0 && <><p className="eyebrow">Watch</p><ul className="stack--sm stack small body" style={{ paddingLeft: 18, listStyle: 'disc' }}>{pl.watch.map((w) => <li key={w}>{w}</li>)}</ul></>}
        {pl.eligibility && <p className="caption">Entry age {pl.eligibility.entryAge[0]}–{pl.eligibility.entryAge[1]}, minimum income ₹{pl.eligibility.minIncomeLakh} lakh, minimum cover ₹{pl.eligibility.minCoverLakh} lakh.</p>}
      </Disclose>
    </div>
  )
}

function Fit({ ok, need, text }: { ok: boolean; need: boolean; text: string }) {
  const bad = need && !ok
  return <li style={{ display: 'flex', gap: 8, color: ok ? '#6ff0a0' : bad ? 'var(--color-orange-400)' : 'var(--ink-muted)' }}><span aria-hidden="true">{ok ? '✓' : bad ? '!' : '–'}</span><span>{text}{bad && <span className="tag" style={{ marginLeft: 8 }}>You need this</span>}</span></li>
}

/* ───────────────────────── HEALTH plans ───────────────────────── */
function HealthPlansView({ f }: { f: Funnel }) {
  const surv = new Set(f.survivors.map((s) => s.slug))
  const plans = HEALTH_PLANS.filter((pl) => surv.has(pl.insurer))
  const noPlan = f.survivors.filter((c) => !HEALTH_PLANS.some((pl) => pl.insurer === c.slug))
  const near = HEALTH_PLANS.filter((pl) => !surv.has(pl.insurer))
  return (
    <section className="stack" aria-label="Plans from insurers that cleared the bar">
      <h2 className="h2">Plans to look at</h2>
      <p className="body small">Five widely compared plans, all with no room-rent limit, no disease sub-limits and no co-pay on the right variant. Premiums depend on age, city and cover, so get a quote on identical terms.</p>
      <div className="grid-2">{plans.map((pl) => <HealthCard key={pl.id} pl={pl} />)}</div>
      {noPlan.length > 0 && <p className="caption">Plan-level details for {noPlan.map((c) => c.name).join(', ')} are not in our data yet. Use the clean-plan checklist from step 3.</p>}
      {near.length > 0 && (
        <div className="card" style={{ padding: '0 20px' }}>
          <Disclose bare title={`Near misses (${near.length})`}>
            {near.map((pl) => {
              const c = f.table.find((x) => x.slug === pl.insurer)
              const fail = c ? Object.values(c.outcomes).find((o) => !o.pass) : undefined
              return <div key={pl.id} className="out"><div className="out__r"><span className="out__n">{insurerBySlug('health', pl.insurer)?.name} · {pl.name}</span><span className="out__w">{fail?.reason ?? 'Did not clear every bar'}</span></div></div>
            })}
            <p className="caption">A near miss is still a legitimate insurer. It missed one published bar. Decide for yourself how much that matters.</p>
          </Disclose>
        </div>
      )}
      <p className="caption">{SOURCES.dittoHealth.note} {SOURCES.nyvo.note}</p>
    </section>
  )
}

function HealthCard({ pl }: { pl: HealthPlan }) {
  return (
    <div className="card stack">
      <div><h3 className="title">{insurerBySlug('health', pl.insurer)?.name}</h3><p className="plan-sub">{pl.name}</p></div>
      <dl className="kv">
        <div className="kv__r"><dt className="kv__k">Room rent</dt><dd className="kv__v" style={{ color: pl.roomRent === 'none' ? '#6ff0a0' : 'var(--color-orange-400)' }}>{pl.roomRent === 'none' ? 'No limit' : 'Depends on variant'}</dd></div>
        <div className="kv__r"><dt className="kv__k">Existing-condition wait</dt><dd className="kv__v">{pl.pedWaitYears} years{pl.pedReducible ? ', reducible' : ''}</dd></div>
        <div className="kv__r"><dt className="kv__k">Specific-illness wait</dt><dd className="kv__v">{pl.specificWaitYears} {pl.specificWaitYears === 1 ? 'year' : 'years'}</dd></div>
        <div className="kv__r"><dt className="kv__k">Network</dt><dd className="kv__v">{pl.networkHospitals ? `${pl.networkHospitals.toLocaleString('en-IN')}+` : '—'}</dd></div>
      </dl>
      <Disclose bare title="What to know">
        <ul className="stack--sm stack small body" style={{ paddingLeft: 18, listStyle: 'disc' }}>
          <li><span className="strong">Restoration:</span> {pl.restoration}</li>
          <li><span className="strong">Renewal bonus:</span> {pl.renewalBonus}</li>
          {pl.highlights.map((h) => <li key={h}>{h}</li>)}
        </ul>
        {pl.variantNote && <p className="flag" data-l="warn"><span className="flag__i" aria-hidden="true" /><span>{pl.variantNote}</span></p>}
        {pl.watch.length > 0 && <><p className="eyebrow">Watch</p><ul className="stack--sm stack small body" style={{ paddingLeft: 18, listStyle: 'disc' }}>{pl.watch.map((w) => <li key={w}>{w}</li>)}</ul></>}
      </Disclose>
    </div>
  )
}

/* ───────────────────────── Plans for you: a carousel ───────────────────────── */
function Recommended({ tab, f }: { tab: Product; f: Funnel }) {
  const { p } = useProfile()
  const { cards } = buildCards(tab, p, f)

  return (
    <section className="stack" aria-label="Plans for you">
      <div className="stack--sm stack">
        <h2 className="h2">{f.survivors.length} of {f.universe} insurers clear the bar</h2>
        <p className="caption">Indicative premiums for your cover. Not quotes.{tab === 'health' && ' Health prices are modelled ranges, not insurer rate sheets. Comparison sites advertise “starting from” prices, which sit below a typical quote.'}</p>
      </div>
      <div className="lead-scroll">
        {cards.map((c) => (
          <article className="card lead-card pcard" key={c.key}>
            <div>
              <h3 className="title">{c.title}</h3>
              {c.plan && <p className="plan-sub">{c.plan}</p>}
            </div>
            <div className="pcard__p">
              <p className="pcard__big">{c.premium}</p>
              <p className="caption">{c.cover}</p>
              {c.withAddons && <p className="pcard__w">With your add-ons <strong>{c.withAddons}</strong></p>}
            </div>
            <ul className="pcard__l">
              {c.lines.map((l, i) => <li key={i} data-ok={l.ok === null ? 'n' : l.ok ? 'y' : 'x'}><span aria-hidden="true">{l.ok === null ? '·' : l.ok ? '✓' : '!'}</span><span>{l.text}</span></li>)}
            </ul>
            {c.note && <p className="caption">{c.note}</p>}
          </article>
        ))}
      </div>
    </section>
  )
}
