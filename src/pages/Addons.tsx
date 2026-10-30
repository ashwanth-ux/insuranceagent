import { ciCover } from '../engine/addons'
import { LAKH, inr, inrFull } from '../engine/format'
import { emit } from '../bridge'
import { addonItems, addonKey, nothingToBuy, outcomeFor, rangeText, shortRange, type AddonItem } from '../engine/selection'
import { effectiveSpend, monthlyEmi } from '../state/derive'
import { useProfile, type Lump, type Product } from '../state/profile'
import { HEALTH_PLAN_CHECKLIST, HEALTH_PLANS, SOURCES, TERM_PLANS, TERM_RIDER_RULES } from '../data/plans'
import { insurerBySlug } from '../engine/kb'
import { useEffect, useState } from 'react'
import { Sheet } from '../ui/Sheet'
import { PRODUCT_NAME, useFlow } from '../flow'
import { NothingToBuy } from '../ui/Impacts'
import { PageHead } from '../ui/Page'
import { Arrow, Choice, Disclose, Question, Seg, Toggle } from '../ui/primitives'

const TABS = [{ id: 'term', label: 'Term life' }, { id: 'health', label: 'Health' }] as const

/** A plan's premium shown as a range, never a single figure: a published illustration is not a quote. */
const around = (n: number, spread = 0.1) => {
  const r = (v: number) => Math.round(v / 500) * 500
  const lo = r(n * (1 - spread)), hi = Math.max(r(n * (1 + spread)), lo + 500)
  return `${inrFull(lo)} to ${inrFull(hi)}`
}

export default function Addons({ go, product }: { go: (to: string) => void; product?: string }) {
  const flow = useFlow()
  const { p } = useProfile()
  const tab: Product = product === 'term' || product === 'health' ? product : 'term'
  const nothing = nothingToBuy(tab, p)
  return (
    <div className="shell shell--wide page flow pagebar">
      <PageHead step={flow.scoped && nothing ? undefined : 3} go={go} title="Add-ons" />
      {!flow.scoped && (
        <div style={{ marginBottom: 16 }}>
          <Seg<Product> label="Product" block value={tab} onChange={(v) => go(`addons/${v}`)} options={TABS.map((t) => ({ id: t.id, label: t.label }))} />
        </div>
      )}
      {nothing ? <NothingToBuy product={PRODUCT_NAME[tab].toLowerCase()} onBack={() => go(flow.to('cover', tab))} onElse={() => go(flow.scoped ? '' : 'need')} /> : <Picker product={tab} go={go} />}
    </div>
  )
}

/* ───────────────────────── The picker ───────────────────────── */
function Switch({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="switch" data-on={on} data-disabled={disabled}>
      <input type="checkbox" role="switch" checked={on} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch__t" aria-hidden="true"><span className="switch__k" /></span>
    </span>
  )
}

function AddonRow({ item, onToggle }: { item: AddonItem; onToggle: (on: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const price = item.cost ? (item.cost.high > 0 ? `+${shortRange(item.cost)}` : 'No extra') : ''
  const more = item.reason !== item.blurb || !!item.watch || !!item.costNote
  return (
    <li className="ao" data-on={item.on}>
      <div className="ao__row">
        <label className="ao__main">
          <Switch on={item.on} disabled={!item.selectable} onChange={onToggle} label={item.label} />
          <span className="ao__txt">
            <span className="ao__top"><span className="ao__name">{item.label}</span>{price && <span className="ao__price">{price}</span>}</span>
            <span className="ao__why">{item.blurb}</span>
          </span>
        </label>
        {more && <button type="button" className="ao__info" aria-expanded={open} aria-label={`Why: ${item.label}`} onClick={() => setOpen((o) => !o)}>{open ? '–' : 'i'}</button>}
      </div>
      {open && (
        <div className="ao__detail">
          <p>{item.reason}</p>
          {item.costNote && !item.cost && <p>{item.costNote}.</p>}
          {item.watch && <p><span className="strong">Watch: </span>{item.watch}</p>}
        </div>
      )}
    </li>
  )
}

function Outcome({ product, go }: { product: Product; go: (to: string) => void }) {
  const { p } = useProfile()
  const flow = useFlow()
  const out = outcomeFor(product, p)
  return (
    <div className="outcome">
      <dl className="kv2">{out.lines.map((l) => <div key={l.label}><dt>{l.label}</dt><dd>{l.value}</dd></div>)}</dl>
      <div className="outcome__total">
        <span className="eyebrow">Premium, a year</span>
        <strong className="outcome__big">{out.total.high > 0 ? rangeText(out.total) : '₹0'}</strong>
        <span className="caption">Indicative, not a quote.</span>
      </div>
      {out.base.high > 0 && out.extras.high > 0 && (
        <dl className="kv2">
          <div><dt>{product === 'health' ? 'Base plans' : 'Base policy'}</dt><dd>{out.base.high > 0 ? rangeText(out.base) : '₹0'}</dd></div>
          <div><dt>Your add-ons</dt><dd>{out.extras.high > 0 ? `+${rangeText(out.extras)}` : 'None priced'}</dd></div>
        </dl>
      )}
      {out.unpriced.length > 0 && <p className="caption">Also on, priced by the insurer: {out.unpriced.join(', ')}.</p>}
      <button type="button" className="link" onClick={() => go(flow.to('cover', product))}>Change my cover answers</button>
    </div>
  )
}

function Picker({ product, go }: { product: Product; go: (to: string) => void }) {
  const { p, set } = useProfile()
  const flow = useFlow()
  const items = addonItems(product, p)
  const out = outcomeFor(product, p)
  const [sum, setSum] = useState(false)
  const [tune, setTune] = useState(false)
  const toggle = (id: string, on: boolean) => set({ addons: { ...p.addons, [addonKey(product, id)]: on } })
  const take = items.filter((i) => i.verdict === 'take'), consider = items.filter((i) => i.verdict === 'consider'), skip = items.filter((i) => i.verdict === 'skip')
  const list = (xs: AddonItem[]) => <ul className="aos">{xs.map((i) => <AddonRow key={i.id} item={i} onToggle={(on) => toggle(i.id, on)} />)}</ul>
  const next = flow.to('insurers', product)
  const total = out.total.high > 0 ? rangeText(out.total) : '₹0'
  const outKey = JSON.stringify([out.lines, out.total, out.picked])
  useEffect(() => { emit({ type: 'outcome', product, lines: out.lines, premium: { low: out.total.low, high: out.total.high }, addons: out.picked }) }, [outKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pick">
      <div className="pick__list">
        <p className="hint2">We switched on what fits you. Prices are per year.</p>
        {take.length > 0 && <section aria-label="Suggested for you"><h2 className="grp">Suggested for you</h2>{list(take)}</section>}
        {consider.length > 0 && <section aria-label="Worth a look"><h2 className="grp">Worth a look</h2>{list(consider)}</section>}
        {skip.length > 0 && <section aria-label="Not for you"><Disclose title={`Not for you right now (${skip.length})`}>{list(skip)}</Disclose></section>}
        <button type="button" className="rowlink" onClick={() => setTune(true)}><span className="rowlink__l"><span className="rowlink__t">Fine-tune</span><span className="rowlink__v">Tell us a bit more to sharpen these</span></span><span className="rowlink__a">Open</span></button>
        <Reference product={product} />
      </div>

      <aside className="pick__out only-d" aria-label="Your cover and premium" aria-live="polite">
        <p className="eyebrow">Your cover and premium</p>
        <Outcome product={product} go={go} />
        <button type="button" className="btn btn--brand btn--block" onClick={() => go(next)}>See which insurers clear the bar <Arrow /></button>
      </aside>

      <div className="pbar only-m" role="region" aria-label="Your premium and next step">
        <button type="button" className="pbar__sum" onClick={() => setSum(true)} aria-label="Show cover and premium breakdown">
          <span className="pbar__c">Premium a year · {out.picked.length} add-on{out.picked.length === 1 ? '' : 's'}</span>
          <strong key={outKey} className="pbar__v">{total}</strong>
        </button>
        <button type="button" className="btn btn--brand" onClick={() => go(next)}>Insurers <Arrow /></button>
      </div>

      <Sheet open={sum} onClose={() => setSum(false)} title="Your cover and premium" doneLabel="Close"><Outcome product={product} go={(t) => { setSum(false); go(t) }} /></Sheet>
      <Sheet open={tune} onClose={() => setTune(false)} title="Fine-tune"><Extra product={product} /></Sheet>
    </div>
  )
}

/** The few questions that change which add-ons we suggest. Optional: the defaults already work. */
function Extra({ product }: { product: Product }) {
  const { p, set } = useProfile()
  return (
    <div className="qs">
      {product === 'term' && <Question title="Do you commute or travel heavily?"><Toggle label="Heavy commute" value={p.heavyCommute} onChange={(heavyCommute) => set({ heavyCommute })} /></Question>}
      {product === 'term' && p.dependents.length > 0 && <Question title="Could the person receiving the money manage a large lump sum?"><Choice<Lump> label="Lump sum" value={p.lumpSum} onChange={(lumpSum) => set({ lumpSum })} options={[{ id: 'yes', label: 'Yes' }, { id: 'unsure', label: 'Not sure' }, { id: 'no', label: 'No' }]} /></Question>}
      {product === 'health' && <Question title="Self-employed or a gig worker?" hint="No sick leave, so an injury also stops your income."><Toggle label="Self-employed" value={p.selfEmployed} onChange={(selfEmployed) => set({ selfEmployed })} /></Question>}
      <Question title="Serious illness in your family?" hint="Heart disease, cancer or diabetes. We never store this."><Toggle label="Family history" value={p.familyHistory} onChange={(familyHistory) => set({ familyHistory })} /></Question>
    </div>
  )
}

const Mark = ({ ok, text }: { ok: boolean | null; text?: string }) => (ok === null ? <span className="muted">Not stated</span> : <span style={{ color: ok ? '#6ff0a0' : 'var(--ink-muted)' }}>{text ?? (ok ? 'Yes' : 'No')}</span>)

/** Reference material, kept out of the way: which plans carry these, what to check before buying. */
function Reference({ product }: { product: Product }) {
  return <Disclose title="Compare plans and terms"><div className="refs"><ReferenceInner product={product} /></div></Disclose>
}

function ReferenceInner({ product }: { product: Product }) {
  const { p } = useProfile()
  if (product === 'term') {
    const ci = ciCover(effectiveSpend(p), monthlyEmi(p))
    return (
      <div className="card" style={{ padding: '0 20px' }}>
        <Disclose bare title="How big should a critical illness cover be?">
          <p className="body small">About {inr(ci.rounded)} for you: {inr(10 * LAKH)} for the treatment gap your health plan will not cover, plus 24 months of household spending and EMIs ({inrFull(Math.round(effectiveSpend(p) + monthlyEmi(p)))} a month). Common advice is ₹{TERM_RIDER_RULES.ciMinLakh}–{TERM_RIDER_RULES.ciMaxLakh} lakh on top of health insurance.</p>
        </Disclose>
        <Disclose title="Which plans carry these riders?">
          <p className="body small">Ten widely compared plans. The waiver-of-premium trigger is the clause that separates a good policy from a great one: a waiver that works only on terminal illness does little through a long illness that is serious but not terminal.</p>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Plan</th><th>Critical illness</th><th>Waiver of premium</th><th>Premium break</th><th className="r">Typical, ₹2 cr at 35</th></tr></thead>
            <tbody>{TERM_PLANS.map((pl) => (
              <tr key={pl.id}>
                <td>{insurerBySlug('life', pl.insurer)?.name ?? pl.insurer}<br /><span className="caption">{pl.name}</span></td>
                <td>{pl.ci.offered ? <>{pl.ci.type === 'accelerated' ? <span style={{ color: 'var(--color-orange-400)' }}>Accelerated</span> : 'Yes'}{pl.ci.illnesses ? <><br /><span className="caption">{pl.ci.illnesses} illnesses</span></> : null}</> : <span className="muted">None</span>}</td>
                <td>{!pl.wop.offered ? <span className="muted">None</span> : pl.wop.trigger === 'ci+disability' ? <span style={{ color: '#6ff0a0' }}>Illness and disability</span> : pl.wop.trigger === 'terminal' ? <span style={{ color: 'var(--color-orange-400)' }}>Terminal illness only</span> : 'Disability'}</td>
                <td><Mark ok={pl.premiumBreak} /></td>
                <td className="r">{around(pl.premium.m35)}</td>
              </tr>))}</tbody>
          </table></div>
          <p className="caption">Premiums are rounded ranges around published illustrations for a healthy 35-year-old man, ₹2 crore to age 65, tier-1 city, without riders. They are not quotes: the insurer sets the price. {SOURCES.dittoTerm.note} Plan details change. Read the brochure before you buy.</p>
        </Disclose>
        <Disclose title="Good to know before you buy">
          <ul className="stack--sm stack body small" style={{ paddingLeft: 18, listStyle: 'disc' }}>
            <li><span className="strong">Waiver of premium</span> usually costs ₹{TERM_RIDER_RULES.wopCostPerYear[0].toLocaleString('en-IN')} to ₹{TERM_RIDER_RULES.wopCostPerYear[1].toLocaleString('en-IN')} a year. Take it.</li>
            <li><span className="strong">Return of premium</span> returns {TERM_RIDER_RULES.ropIrr}. Buy plain term and invest the difference.</li>
            <li><span className="strong">Limited pay.</span> {TERM_RIDER_RULES.limitedPay}</li>
            <li><span className="strong">Pay annually.</span> {TERM_RIDER_RULES.premiumModal}</li>
            <li><span className="strong">Compare the 25-year total.</span> {TERM_RIDER_RULES.yearOneDiscount}</li>
            <li><span className="strong">Disclose everything.</span> After three years an insurer can contest a policy only for proven fraud. Inside three years, a hidden fact can sink the claim.</li>
          </ul>
        </Disclose>
      </div>
    )
  }
  return (
    <div className="card" style={{ padding: '0 20px' }}>
      <Disclose bare title="The clean-plan checklist">
        <p className="body small">Two plans with the same ₹10 lakh sum insured can pay very different amounts on the same bill. Check these eight things in the policy wording, not the brochure.</p>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Check</th><th>What good looks like</th></tr></thead>
          <tbody>{HEALTH_PLAN_CHECKLIST.map((c) => <tr key={c.id}><td>{c.label}<br /><span className="caption" style={{ fontWeight: 500 }}>{c.note}</span></td><td>{c.good}</td></tr>)}</tbody></table></div>
      </Disclose>
      <Disclose title="Five well-known plans, side by side">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Plan</th><th>Room rent</th><th>Existing-condition wait</th><th>Restoration</th><th>Renewal bonus</th></tr></thead>
          <tbody>{HEALTH_PLANS.map((pl) => (
            <tr key={pl.id}>
              <td>{insurerBySlug('health', pl.insurer)?.name ?? pl.insurer}<br /><span className="caption">{pl.name}</span></td>
              <td>{pl.roomRent === 'none' ? <span style={{ color: '#6ff0a0' }}>No limit</span> : <span style={{ color: 'var(--color-orange-400)' }}>Depends on variant</span>}</td>
              <td>{pl.pedWaitYears} years{pl.pedReducible ? <><br /><span className="caption">Add-on can cut it</span></> : null}</td>
              <td className="muted" style={{ fontWeight: 500 }}>{pl.restoration}</td>
              <td className="muted" style={{ fontWeight: 500 }}>{pl.renewalBonus}</td>
            </tr>))}</tbody>
        </table></div>
        {HEALTH_PLANS.filter((x) => x.variantNote).map((x) => <p key={x.id} className="caption"><span className="strong">{x.name}: </span>{x.variantNote}</p>)}
        <p className="caption">{SOURCES.dittoHealth.note} {SOURCES.nyvo.note} Plan terms change. Confirm the variant on your quote.</p>
      </Disclose>
    </div>
  )
}

