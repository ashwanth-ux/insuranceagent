import { useState, type ReactNode } from 'react'
import { LAKH, CRORE, inr, inrFull, pct, roundTo, times } from '../engine/format'
import { computeHealth, healthPayout, hospitalLabel, type HospitalTier } from '../engine/health'
import { LIMITS } from '../engine/limits'
import { computeNeeds } from '../engine/needs'
import { computeTerm } from '../engine/term'
import { bundleFor } from '../engine/bundles'
import { effectiveParentSupport, effectiveLoans, effectiveSpend, estimateLoans, estimateMonthlySpend, hasLoanFlag, healthInputOf, kidsOf, needsInputOf, termInputOf } from '../state/derive'
import { useProfile, type Product } from '../state/profile'
import type { CityTier } from '../engine/types'
import { useFlow } from '../flow'
import { Sheet } from '../ui/Sheet'
import { nothingToBuy } from '../engine/selection'
import { PageHead } from '../ui/Page'
import { AssumptionSummary, ImpactPanel, KeepList, PlanLines, Ripple, StandingHero } from '../ui/Impacts'
import { assumptionsFor } from '../engine/assumptions'
import { healthPlansView, healthStanding, termStanding } from '../engine/standing'
import { Arrow, Choice, Disclose, Flags, KV, Money, Multi, Question, RangeBar, Seg, Stepper, useTween } from '../ui/primitives'

const TABS = [{ id: 'term', label: 'Term life' }, { id: 'health', label: 'Health' }] as const

export default function Amount({ go, product }: { go: (to: string) => void; product?: string }) {
  const { p } = useProfile()
  const flow = useFlow()
  const needs = computeNeeds(needsInputOf(p))
  const first = needs.firstMove?.product ?? 'term'
  const tab: Product = product === 'term' || product === 'health' ? product : first
  const nothing = nothingToBuy(tab, p)

  return (
    <div className="shell shell--wide page flow">
      <PageHead step={flow.scoped && nothing ? undefined : 2} go={go} title="Your cover" />
      {!flow.scoped && (
        <div style={{ marginBottom: 24 }}>
          <Seg<Product> label="Product" value={tab} onChange={(v) => go(`amount/${v}`)} options={TABS.map((t) => ({ id: t.id, label: t.label }))} />
        </div>
      )}
      {tab === 'term' && <TermAmount go={go} />}
      {tab === 'health' && <HealthAmount go={go} />}
    </div>
  )
}

export interface Live { label: string; value: string; sub?: string }

/**
 * Shared wrapper. The answer comes first, with what it assumed beside it. Most people never type anything.
 * "Edit" opens a sheet with the questions: the answer behind it updates as they type, and closing it puts them back at the answer.
 */
function Flow({ questions, summary, details, live, go, product }: { questions: ReactNode; summary: () => ReactNode; details: ReactNode; live: Live; go: (to: string) => void; product: Product }) {
  const { p } = useProfile()
  const flow = useFlow()
  const nextTo = flow.to('addons', product)
  const nothing = nothingToBuy(product, p)
  const suggested = nothing ? [] : bundleFor(product, p).takes
  const items = assumptionsFor(product, p)
  // Arriving at one product on its own, with nothing known yet, starts with a few details instead of a guess.
  const [editing, setEditing] = useState(flow.scoped && !p.touched.age)
  const [flash, setFlash] = useState(0)
  const close = () => {
    setEditing(false)
    setFlash((n) => n + 1)
    // Back to the answer, so the change is what they see.
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }
  // With nothing to buy there is no add-on or insurer step, so the way on is to adjust the answers or look at something else.
  const cta = nothing
    ? <button type="button" className="btn btn--brand btn--block" onClick={() => (product === 'term' && p.dependents.length === 0 ? setEditing(true) : go(flow.scoped ? '' : 'need'))}>{product === 'term' && p.dependents.length === 0 ? 'Add a goal or someone who depends on you' : 'Check another insurance'} <Arrow /></button>
    : <button type="button" className="btn btn--brand btn--block" onClick={() => go(nextTo)}>Choose add-ons <Arrow /></button>
  const basedOn = items.slice(0, 3).map((i) => i.value).join(' · ')
  const guessed = items.filter((i) => i.suggested).length

  return (
    <>
      <div className="sum">
        <section className="sum__main" aria-live="polite" aria-label="Your answer" key={flash} data-flash={flash > 0}>
          {summary()}
          {!nothing && (
            <button type="button" className="rowlink" onClick={() => go(nextTo)}>
              <span className="rowlink__l">
                <span className="rowlink__t">{suggested.length > 0 ? 'Add-ons for you' : 'Add-ons'}</span>
                <span className="rowlink__v">{suggested.length > 0 ? `${suggested[0]}${suggested.length > 1 ? ` and ${suggested.length - 1} more` : ''}` : 'None needed right now'}</span>
              </span>
              <Chev />
            </button>
          )}
          <div className="only-d">{cta}</div>
        </section>

        <aside className="sum__side" aria-label="What we assumed">
          <div className="only-d"><div className="assume--card"><AssumptionSummary items={items} onEdit={() => setEditing(true)} /></div></div>
          <button type="button" className="rowlink only-m" onClick={() => setEditing(true)}>
            <span className="rowlink__l">
              <span className="rowlink__t">Based on{guessed > 0 ? ` · ${guessed} assumed` : ''}</span>
              <span className="rowlink__v">{basedOn}</span>
            </span>
            <span className="rowlink__a">Edit</span>
          </button>
        </aside>
      </div>

      <Disclose title="Details and working"><div className="stack stack--lg">{details}</div></Disclose>

      <div className="actionbar only-m">{cta}</div>

      <Sheet open={editing} onClose={close} title="Your details" live={<LiveLine live={live} />}>
        <div className="qs">{flow.scoped && <AboutYou product={product} />}{questions}</div>
      </Sheet>
    </>
  )
}

function LiveLine({ live }: { live: Live }) {
  return <div className="liveline"><span className="liveline__l">{live.label}</span><strong>{live.value}</strong>{live.sub && <span className="liveline__s">{live.sub}</span>}</div>
}

const Chev = () => <svg className="rowlink__c" width="9" height="15" viewBox="0 0 9 15" fill="none" aria-hidden="true"><path d="M1.5 1.5L7.5 7.5L1.5 13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>

function Big({ value, label, unit, sub }: { value: number; label: string; unit?: string; sub?: ReactNode }) {
  const v = useTween(value)
  return (
    <div className="stack--sm stack">
      <p className="eyebrow result__eyebrow">{label}</p>
      <p className="result__big" aria-label={`${label}: ${inr(value)}`}>{inr(v)}{unit && <span className="result__unit">{unit}</span>}</p>
      {sub && <p className="body small">{sub}</p>}
    </div>
  )
}

const Rows = ({ rows }: { rows: [string, ReactNode][] }) => <KV rows={rows} />
const range = (low: number, high: number) => (low === high ? inrFull(low) : `${inrFull(low)} to ${inrFull(high)}`)

/* ───────────────────────── TERM ───────────────────────── */
function TermAmount({ go }: { go: (to: string) => void }) {
  const { p, set } = useProfile()
  const r = computeTerm(termInputOf(p))
  const kids = kidsOf(p)
  const spouse = p.dependents.includes('spouse')
  const depends = p.dependents.length > 0
  const loanOn = hasLoanFlag(p)
  const spendEst = p.monthlySpend === null
  const loanEst = loanOn && p.loans === null
  const bn = effectiveSpend(p)
  const st = termStanding(p)

  const setLoans = (on: boolean) => {
    const isLoan = (o: string) => o === 'homeLoan' || o === 'vehicleLoan' || o === 'otherLoan'
    set({ owns: on ? (p.owns.some(isLoan) ? p.owns : [...p.owns, 'otherLoan' as const]) : p.owns.filter((o) => !isLoan(o)) })
  }

  const questions = (
    <>
      <Question title="Who depends on your income, and for how long?">
        <Multi label="Who depends on you" value={p.dependents} none="Nobody" onChange={(dependents) => set({ dependents })} options={[{ id: 'spouse', label: 'Spouse or partner' }, { id: 'children', label: 'Children' }, { id: 'parents', label: 'Parents' }]} />
        {spouse && (
          <div className="sub"><span className="sub__l">Does your spouse or partner earn?</span>
            <Seg label="Spouse earns" value={p.spouseEarns ? 'y' : 'n'} onChange={(v) => set({ spouseEarns: v === 'y' })} options={[{ id: 'n', label: 'Stays at home' }, { id: 'y', label: 'Earns' }]} /></div>
        )}
        {kids > 0 && (
          <div className="sub">
            <span className="sub__l">Children, and the youngest one’s age</span>
            <div className="row" style={{ gap: 12 }}>
              <Stepper label="Number of children" value={p.kids} min={1} max={6} onChange={(k) => set({ kids: k })} unit={p.kids === 1 ? 'child' : 'children'} />
              <Stepper label="Youngest child's age" value={p.youngestChildAge} min={LIMITS.childAge.min} max={LIMITS.childAge.max} onChange={(a) => set({ youngestChildAge: a })} unit="yrs old" />
            </div>
          </div>
        )}
        {p.dependents.includes('parents') && (
          <div className="sub"><span className="sub__l">What you send or spend on your parents each month {p.parentSupportMonthly === null && <span className="tag tag--muted" style={{ marginLeft: 6 }}>Estimate</span>}</span>
            <Money label="Monthly support for parents" hideLabel estimated={p.parentSupportMonthly === null} value={effectiveParentSupport(p)} min={LIMITS.parentSupport.min} max={LIMITS.parentSupport.max} step={LIMITS.parentSupport.step} why={LIMITS.parentSupport.why}
              presets={[{ label: 'None', value: 0 }, { label: '₹10,000', value: 10_000 }, { label: '₹25,000', value: 25_000 }, { label: '₹50,000', value: 50_000 }]}
              hint={p.parentSupportMonthly === null ? 'Our assumption. Put in what you really send. If it is already inside your household spending in question 2, set it to zero so it is not counted twice.' : 'Counted for the years your parents are likely to need it, on top of the household spending in question 2.'} onChange={(parentSupportMonthly) => set({ parentSupportMonthly })} />
          </div>
        )}
        {depends && (
          <div className="sub"><span className="sub__l">Years of support we will plan for {p.yearsOverride === null && <span className="tag tag--muted" style={{ marginLeft: 6 }}>Suggested</span>}</span>
            <div className="row" style={{ gap: 12 }}>
              <Stepper label="Years of support" value={r.N} min={LIMITS.years.min} max={Math.min(LIMITS.years.max, Math.max(LIMITS.years.min, 85 - p.age))} onChange={(n) => set({ yearsOverride: n })} unit="years" />
              {p.yearsOverride !== null && <button type="button" className="btn btn--ghost btn--small" onClick={() => set({ yearsOverride: null })}>Use suggested</button>}
            </div>
          </div>
        )}
        <Ripple product="term" ids={['spouse', 'spouseEarns', 'children', 'parents']} />
      </Question>

      <Question title="What does your household spend in a month?">
        <Money label="Monthly household spending" hideLabel estimated={spendEst} value={bn} min={LIMITS.monthlySpend.min} max={LIMITS.monthlySpend.max} step={LIMITS.monthlySpend.step} why={LIMITS.monthlySpend.why}
          presets={[{ label: '₹30,000', value: 30_000 }, { label: '₹50,000', value: 50_000 }, { label: '₹75,000', value: 75_000 }, { label: '₹1 lakh', value: LAKH }, { label: '₹2 lakh', value: 2 * LAKH }]}
          hint={spendEst ? `Our estimate from your income (${inrFull(estimateMonthlySpend(p.income))} a month). Change it if you know better.` : undefined} onChange={(monthlySpend) => set({ monthlySpend })} />
      </Question>

      <Question title="Which loans are still outstanding?">
        <Seg label="Loans" value={loanOn ? 'y' : 'n'} onChange={(v) => setLoans(v === 'y')} options={[{ id: 'n', label: 'No loans' }, { id: 'y', label: 'I have loans' }]} />
        {loanOn && <Money label="Loan balance outstanding" hideLabel estimated={loanEst} value={effectiveLoans(p)} min={LIMITS.loans.min + 50_000} max={LIMITS.loans.max} step={LIMITS.loans.step} why={LIMITS.loans.why}
          hint={loanEst ? `Our rough guess from your income (${inr(estimateLoans(p))}). Put in what you still owe.` : 'Total still to repay, all loans together.'} onChange={(loans) => set({ loans })} />}
      </Question>

      <Question title="Any big goals the cover should protect?">
        {kids > 0 && (
          <Multi label="Goals for your children" value={[...(p.goalEducation ? ['edu' as const] : []), ...(p.goalMarriage ? ['mar' as const] : [])]} none="None" options={[{ id: 'edu', label: 'Children’s education' }, { id: 'mar', label: 'Children’s marriage' }]}
            onChange={(v) => set({ goalEducation: v.includes('edu'), goalMarriage: v.includes('mar') })} />
        )}
        <GoalsEditor />
      </Question>

      <Question title="What does your family already have?">
        <Money label="Savings you could spare" value={p.freeSavings} min={LIMITS.freeSavings.min} max={LIMITS.freeSavings.max} step={LIMITS.freeSavings.step} why={LIMITS.freeSavings.why}
          presets={[{ label: 'None', value: 0 }, { label: '₹5 lakh', value: 5 * LAKH }, { label: '₹25 lakh', value: 25 * LAKH }, { label: '₹1 crore', value: CRORE }]} onChange={(freeSavings) => set({ freeSavings })} />
        <div className="stack--sm stack"><span className="label">Term plan you pay for yourself</span>
          <Seg label="Existing term" value={p.covered.includes('ownTerm') ? 'y' : 'n'} onChange={(v) => set({ covered: v === 'y' ? [...p.covered.filter((c) => c !== 'ownTerm'), 'ownTerm'] : p.covered.filter((c) => c !== 'ownTerm') })} options={[{ id: 'n', label: 'None' }, { id: 'y', label: 'I have one' }]} />
        </div>
        {p.covered.includes('ownTerm') && <Money label="Cover you already hold" value={p.existingTerm} min={5 * LAKH} max={LIMITS.existingTerm.max} step={LIMITS.existingTerm.step} why={LIMITS.existingTerm.why}
          presets={[{ label: '₹50 lakh', value: 50 * LAKH }, { label: '₹1 crore', value: CRORE }, { label: '₹2 crore', value: 2 * CRORE }]} hint="Employer group cover is not counted. It ends with the job." onChange={(existingTerm) => set({ existingTerm })} />}
      </Question>
    </>
  )

  const binding = r.flags.filter((f) => /Insurers would likely approve/.test(f.text))
  const premiumRows: [string, ReactNode][] = [
    ['Typical premium', <>{range(r.premium.low, r.premium.high)} a year <span className="tag tag--muted">Indicative</span></>],
  ]
  const summary = (): ReactNode => {
    if (st.kind === 'sorted') return <StandingHero s={st} compact />
    if (r.noNeed) {
      const unknown = !p.touched.dependents && !p.touched.owns
      return (
        <div className="stack">
          <p className="eyebrow result__eyebrow">Term cover</p>
          <h2 className="h1">{unknown ? 'Tell us who depends on you.' : 'You may not need term cover yet.'}</h2>
          <p className="body small">{unknown ? 'Tap Edit and we will work it out.' : r.gapTooSmall ? 'Nobody depends on your income, and what is left to cover is too small for a policy of its own.' : 'Nobody depends on your income and you owe nothing.'}</p>
        </div>
      )
    }
    return (
      <>
        {st.kind === 'partly' ? (
          <Big value={r.recommended} label={st.addLabel} sub={<>You hold {inr(r.existing)} of the {inr(r.grossNeed)} needed.</>} />
        ) : <Big value={r.recommended} label="Term cover to buy" sub={r.raisedToMin ? <>Your need works out to about {inr(roundTo(r.need.mid, 1000))}. {inr(25 * LAKH)} is the smallest policy we suggest.</> : !p.noIncome ? <>About {times(r.multipleOfIncome, 1)} your yearly income.</> : 'Replaces the cost of your work.'} />}
        <Rows rows={premiumRows} />
        <Flags items={binding} />
      </>
    )
  }
  const live: Live = { label: 'Term cover', value: r.noNeed ? '—' : inr(r.recommended), sub: r.noNeed ? undefined : `${range(r.premium.low, r.premium.high)} a year` }
  const details = (
    <>
      {st.kind === 'sorted' && <KeepList items={st.keep} />}
      {!r.noNeed && st.kind !== 'sorted' && (
        <div className="stack--sm stack">
          <RangeBar low={r.need.low} mid={r.need.mid} high={r.need.high} label={st.kind === 'partly' ? 'Extra cover needed' : 'Cover needed'} />
          <p className="caption">Sensible range {st.kind === 'partly' ? 'for the extra cover: ' : ''}{inr(r.need.low)} to {inr(r.need.high)}. The low end assumes your family’s payout earns more.</p>
        </div>
      )}
      <Rows rows={[...(p.noIncome ? [] : ([['Premium as a share of income', pct(r.premiumPctOfIncome, 1)]] as [string, ReactNode][])), ['Support years we planned', depends ? `${r.N} years` : '—']]} />
      <Flags items={r.flags} />
      <ImpactPanel product="term" />
      <div className="stack stack--sm"><p className="eyebrow">How we got this</p><Steps r={r} /></div>
    </>
  )

  return <Flow product="term" questions={questions} summary={summary} details={details} live={live} go={go} />
}

function Steps({ r }: { r: ReturnType<typeof computeTerm> }) {
  return (
    <>
      <p className="body small">Cover = money to replace your income for the years needed + loans + big goals − what your family already has. Every line below is a number you can check.</p>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Step</th><th>Working</th><th className="r">Amount</th></tr></thead>
        <tbody>{r.steps.map((s, i) => <tr key={i}><td>{s.label}</td><td className="muted" style={{ fontWeight: 500 }}>{s.formula ?? ''}</td><td className="r">{s.value}</td></tr>)}</tbody>
      </table></div>
      {r.N > 0 && (
        <>
          <p className="eyebrow">If your assumptions change</p>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Payout earns</th>{r.sensitivity.years.map((y) => <th key={y} className="r">{y} years</th>)}</tr></thead>
            <tbody>{r.sensitivity.returns.map((rt, i) => <tr key={rt}><td>{pct(rt * 100, 1)} a year</td>{r.sensitivity.grid[i].map((v, j) => <td key={j} className="r" data-hl={rt === 0.07 && j === 1}>{inr(v)}</td>)}</tr>)}</tbody>
          </table></div>
        </>
      )}
      <p className="caption">Premium is an indicative range calibrated to ten published plan quotes (Ditto, Sept 2026). Individual life premiums carry no GST since 22 September 2025. Insurers decide the final price after underwriting.</p>
    </>
  )
}

/* ───────────────────────── HEALTH ───────────────────────── */
function HealthAmount({ go }: { go: (to: string) => void }) {
  const { p, set } = useProfile()
  const r = computeHealth(healthInputOf(p))
  const kids = kidsOf(p)
  const parentsOn = p.dependents.includes('parents')
  const setOwn = (n: number) => set({ ownCover: n, covered: n > 0 ? [...new Set([...p.covered, 'ownHealth' as const])] : p.covered.filter((c) => c !== 'ownHealth') })
  const setEmp = (n: number) => set({ employerCover: n, covered: n > 0 ? [...new Set([...p.covered, 'employerHealth' as const])] : p.covered.filter((c) => c !== 'employerHealth') })
  const st = healthStanding(p)
  const planFor = [...(p.knownCondition ? ['cond' as const] : []), ...(p.familyHistory ? ['fam' as const] : []), ...(p.babyPlanned ? ['baby' as const] : [])]

  const questions = (
    <>
      <Question title="Who needs cover?">
        <Multi label="Who needs cover" value={p.dependents} none="Just me" onChange={(dependents) => set({ dependents })} options={[{ id: 'spouse', label: 'Spouse or partner' }, { id: 'children', label: 'Children' }, { id: 'parents', label: 'Parents' }]} />
        {kids > 0 && <div className="sub"><span className="sub__l">Children</span><Stepper label="Number of children" value={p.kids} min={1} max={6} onChange={(k) => set({ kids: k })} unit={p.kids === 1 ? 'child' : 'children'} /></div>}
        {parentsOn && (
          <div className="sub"><span className="sub__l">Parents</span>
            <Seg label="How many parents" value={String(p.parents) as '1' | '2'} onChange={(v) => set({ parents: v === '1' ? 1 : 2 })} options={[{ id: '1', label: 'One parent' }, { id: '2', label: 'Both parents' }]} />
            <Stepper label="Parent's age" value={p.parentAge} min={LIMITS.parentAge.min} max={LIMITS.parentAge.max} onChange={(parentAge) => set({ parentAge })} unit="yrs old" />
          </div>
        )}
        <Ripple product="health" ids={['spouse', 'children', 'parents']} />
      </Question>

      <Question title="Where do you live, and which hospitals would you use?">
        <Choice<CityTier> label="City" value={p.city} onChange={(city) => set({ city })} options={[{ id: 'metro', label: 'Big metro' }, { id: 'tier2', label: 'Tier-2 city' }, { id: 'other', label: 'Smaller town' }]} />
        <Choice<HospitalTier> label="Hospitals" value={p.hospital} onChange={(hospital) => set({ hospital })} options={(['top', 'standard', 'local'] as const).map((id) => ({ id, label: hospitalLabel[id] }))} />
      </Question>

      <Question title="What health cover do you already have?">
        <Money label="Health plan you pay for" value={p.ownCover} min={0} max={LIMITS.ownHealth.max} step={LIMITS.ownHealth.step} why={LIMITS.ownHealth.why}
          presets={[{ label: 'None', value: 0 }, { label: '₹5 lakh', value: 5 * LAKH }, { label: '₹10 lakh', value: 10 * LAKH }, { label: '₹25 lakh', value: 25 * LAKH }, { label: '₹50 lakh', value: 50 * LAKH }]} onChange={setOwn} />
        <Money label="Cover from your employer" value={p.employerCover} min={0} max={LIMITS.employerHealth.max} step={LIMITS.employerHealth.step} why={LIMITS.employerHealth.why}
          presets={[{ label: 'None', value: 0 }, { label: '₹3 lakh', value: 3 * LAKH }, { label: '₹5 lakh', value: 5 * LAKH }, { label: '₹10 lakh', value: 10 * LAKH }]} noSlider onChange={setEmp} />
      </Question>

      <Question title="Is there anything we should plan for?">
        <Multi label="Health situation" value={planFor} none="No" onChange={(v) => set({ knownCondition: v.includes('cond'), familyHistory: v.includes('fam'), babyPlanned: v.includes('baby') })}
          options={[{ id: 'cond', label: 'A known condition' }, { id: 'fam', label: 'Serious illness in my family' }, { id: 'baby', label: 'A baby in the next few years' }]} />
        <Ripple product="health" ids={['knownCondition', 'familyHistory', 'babyPlanned']} />
      </Question>

      <Question title="What hospital bill could you pay from savings?">
        <Money label="Bill you could pay from savings" hideLabel value={p.savingsForBill} min={0} max={LIMITS.savingsForBill.max} step={LIMITS.savingsForBill.step} why={LIMITS.savingsForBill.why}
          presets={[{ label: '₹1 lakh', value: LAKH }, { label: '₹5 lakh', value: 5 * LAKH }, { label: '₹10 lakh', value: 10 * LAKH }, { label: '₹25 lakh', value: 25 * LAKH }]} onChange={(savingsForBill) => set({ savingsForBill })} />
        <Ripple product="health" ids={['savingsForBill']} />
      </Question>
    </>
  )

  const plans = healthPlansView(p)
  const buy = r.basePlans.buyPremium
  const extraRows: [string, ReactNode][] = [
    ...(r.loaded ? ([['Known-condition loading', <>Already inside the premiums here <span className="tag tag--muted">15 to 30%</span></>]] as [string, ReactNode][]) : []),
    ...(p.employerCover > 0 ? ([['Your employer cover', <>Not counted: it ends with the job. Keep it as a bonus.</>]] as [string, ReactNode][]) : []),
  ]
  const hasParents = !!r.basePlans.parents
  const summary = (): ReactNode => {
    // One plan needs no list and no total: the premium says it all. Two or more get a list, and a total that adds something.
    const several = plans.length > 1
    const total: [string, ReactNode][] = buy.high > 0 ? [[st.kind === 'sorted' ? (r.basePlans.parents?.count === 1 ? 'Parent’s plan, a year' : 'Parents’ plans, a year') : several ? 'All together, a year' : 'Premium, a year', <><span className="strong">{range(buy.low, buy.high)}</span></>]] : []
    if (st.kind === 'sorted') return (
      <>
        <StandingHero s={st} compact />
        {several && <PlanLines plans={plans} />}
        {total.length > 0 && <Rows rows={total} />}
      </>
    )
    return (
      <>
        {st.kind === 'partly' ? (
          <Big value={st.add} label={st.addLabel} sub={<>You hold {inr(st.have)}. A clean base is {inr(st.target)}.</>} />
        ) : (
          <Big value={r.basePlans.totalCover} label={hasParents ? 'Base cover, all plans' : 'Base cover'}
            sub={hasParents ? `${r.basePlans.planCount} plans. Parents get their own, so their claims never use up your family’s limit.` : undefined} />
        )}
        {several && <PlanLines plans={plans} />}
        <Rows rows={total} />
      </>
    )
  }
  const live: Live = { label: 'Base cover', value: st.kind === 'sorted' ? 'Sorted' : inr(st.kind === 'partly' ? st.add : r.basePlans.totalCover), sub: buy.high > 0 ? `${range(buy.low, buy.high)} a year` : undefined }
  const details = (
    <>
      {st.kind === 'sorted' && <KeepList items={st.keep} />}
      {plans.some((x) => x.role !== 'have') && <ul className="notes">{plans.filter((x) => x.role !== 'have').slice(0, 2).map((x) => <li key={x.id + x.short}><span className="strong">{x.id === 'parent' ? 'Parents' : x.short}: </span>{x.why}</li>)}</ul>}
      {extraRows.length > 0 && <Rows rows={extraRows} />}
      <Flags items={st.kind === 'sorted' ? r.flags.filter((f) => f.level === 'critical' || f.level === 'warn') : r.flags} />
      <ImpactPanel product="health" />
      <div className="stack stack--sm"><p className="eyebrow">How we got this</p><HealthWorking r={r} /></div>
    </>
  )

  return <Flow product="health" questions={questions} summary={summary} details={details} live={live} go={go} />
}

function HealthWorking({ r }: { r: ReturnType<typeof computeHealth> }) {
  const rows = [3.5 * LAKH, 15 * LAKH, 35 * LAKH, 1.2 * CRORE].map((b) => ({ b, ...healthPayout(b, r.base, r.superTopUp, r.deductible) }))
  return (
    <>
      <p className="body small">Health insurance reimburses actual bills, so the wording matters more than the headline number. We size a stack: a base plan for everyday bills and a super top-up for the tail.</p>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Step</th><th>Working</th><th className="r">Result</th></tr></thead>
        <tbody>{r.steps.map((s, i) => <tr key={i}><td>{s.label}</td><td className="muted" style={{ fontWeight: 500 }}>{s.formula ?? ''}</td><td className="r">{s.value}</td></tr>)}</tbody></table></div>
      <p className="eyebrow">How the stack pays in a year</p>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Hospital bills</th><th className="r">Base pays</th><th className="r">Top-up pays</th><th className="r">You pay</th></tr></thead>
        <tbody>{rows.map((x) => <tr key={x.b}><td>{inr(x.b)}</td><td className="r">{inr(x.fromBase)}</td><td className="r">{inr(x.fromTop)}</td><td className="r">{inr(x.youPay)}</td></tr>)}</tbody></table></div>
      <p className="caption">Assumes every item is payable. Room-rent caps and exclusions would reduce it.</p>
      <p className="eyebrow">Why it needs a review</p>
      <p className="body small">Medical costs rise about 11 to 14% a year. At 12%, ₹10 lakh buys what {inr(roundTo(r.decay[1].value, 1000))} buys today in 10 years, and {inr(roundTo(r.decay[2].value, 1000))} in 15. Review every three to five years.</p>
      <p className="caption">Premiums are indicative ranges for a healthy applicant, ex-GST (individual health premiums carry no GST since 22 September 2025). Waiting periods: up to {r.waits.ped} months for existing conditions, and after {r.waits.moratorium} months of continuous cover an insurer cannot reject a claim for non-disclosure, except fraud.</p>
      <p className="caption">Calibrated to market ranges, not insurer rate sheets. We will replace this with real rate data as it becomes available.</p>
    </>
  )
}

/** The few things we need when someone arrives at one product with nothing known yet. */
function AboutYou({ product }: { product: Product }) {
  const { p, set } = useProfile()
  return (
    <Question title="About you" hint={product === 'term' ? 'Age, gender and tobacco use change the price. Income sets the most an insurer will sell you.' : 'Your age sets the price of the plan.'}>
      <div className="stack--sm stack"><span className="label">Your age</span><Stepper label="Your age" value={p.age} min={LIMITS.age.min} max={LIMITS.age.max} unit="years" onChange={(age) => set({ age })} /></div>
      {product === 'term' && (
        <>
          <div className="stack--sm stack"><span className="label">Gender</span><Seg label="Gender" value={p.gender} onChange={(gender) => set({ gender })} options={[{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }, { id: 'other', label: 'Other' }]} /></div>
          <div className="stack--sm stack"><span className="label">Tobacco</span><Seg label="Tobacco" value={p.smoker ? 's' : 'n'} onChange={(v) => set({ smoker: v === 's' })} options={[{ id: 'n', label: 'No tobacco' }, { id: 's', label: 'Smoke or chew' }]} /></div>
          <Money label="Yearly income, before tax" value={p.income} min={LIMITS.income.min} max={LIMITS.income.max} step={LIMITS.income.step} why={LIMITS.income.why}
            presets={[{ label: '₹6 lakh', value: 6 * LAKH }, { label: '₹12 lakh', value: 12 * LAKH }, { label: '₹24 lakh', value: 24 * LAKH }, { label: '₹50 lakh', value: 50 * LAKH }]} onChange={(income) => set({ income })} />
        </>
      )}
    </Question>
  )
}

const GOAL_PRESETS = [
  { label: 'Buy a house', todayCost: 50 * LAKH, yearsAway: 5 },
  { label: 'My wedding', todayCost: 15 * LAKH, yearsAway: 3 },
  { label: 'Start a business', todayCost: 25 * LAKH, yearsAway: 4 },
  { label: 'Other goal', todayCost: 10 * LAKH, yearsAway: 5 },
] as const

/** Goals anyone can add, whether or not anyone depends on them. Each is a cost in today's money and the years until it is needed. */
function GoalsEditor() {
  const { p, set } = useProfile()
  const goals = p.goals
  const update = (i: number, patch: Partial<(typeof goals)[number]>) => set({ goals: goals.map((g, k) => (k === i ? { ...g, ...patch } : g)) })
  return (
    <div className="stack">
      {goals.length > 0 && (
        <ul className="goals">
          {goals.map((g, i) => (
            <li className="goal" key={i}>
              <div className="goal__h">
                {g.label === 'Other goal' || !GOAL_PRESETS.some((x) => x.label === g.label)
                  ? <input className="input goal__name" aria-label="Goal name" value={g.label === 'Other goal' ? '' : g.label} maxLength={40} placeholder="Name this goal" onChange={(e) => update(i, { label: e.target.value || 'Other goal' })} />
                  : <span className="goal__t">{g.label}</span>}
                <button type="button" className="goal__x" aria-label={`Remove ${g.label}`} onClick={() => set({ goals: goals.filter((_, k) => k !== i) })}>Remove</button>
              </div>
              <Money label="Cost in today’s money" value={g.todayCost} min={LIMITS.goalCost.min} max={LIMITS.goalCost.max} step={LIMITS.goalCost.step} why={LIMITS.goalCost.why}
                presets={[{ label: '₹10 lakh', value: 10 * LAKH }, { label: '₹25 lakh', value: 25 * LAKH }, { label: '₹50 lakh', value: 50 * LAKH }, { label: '₹1 crore', value: CRORE }]} onChange={(todayCost) => update(i, { todayCost })} />
              <div className="stack--sm stack"><span className="label">Needed in</span><Stepper label="Years until you need it" value={g.yearsAway} min={LIMITS.goalYears.min} max={LIMITS.goalYears.max} unit="years" onChange={(yearsAway) => update(i, { yearsAway })} /></div>
            </li>
          ))}
        </ul>
      )}
      {goals.length < 5 && (
        <div className="stack--sm stack">
          <span className="label">{goals.length === 0 ? 'Add a goal' : 'Add another'}</span>
          <div className="row">{GOAL_PRESETS.map((g) => <button key={g.label} type="button" className="chip chip--soft" onClick={() => set({ goals: [...goals, { ...g }] })}>+ {g.label}</button>)}</div>
        </div>
      )}
    </div>
  )
}
