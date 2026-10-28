import { useState, type ReactNode } from 'react'
import { LAKH, CRORE } from '../engine/format'
import { LIMITS } from '../engine/limits'
import { computeNeeds, stageLabel, type Covered, type Dependent, type NeedStatus, type Owns } from '../engine/needs'
import { firstLine } from '../engine/selection'
import { needsInputOf } from '../state/derive'
import { useProfile } from '../state/profile'
import { PageHead } from '../ui/Page'
import { Arrow, Chip, Disclose, Flags, Money, Multi, Seg, Stepper } from '../ui/primitives'

const DEPS = [{ id: 'spouse', label: 'Spouse or partner' }, { id: 'children', label: 'Children' }, { id: 'parents', label: 'Parents' }] as const
const LOANS = [{ id: 'homeLoan', label: 'Home loan' }, { id: 'vehicleLoan', label: 'Car or bike loan' }, { id: 'otherLoan', label: 'Personal or other loan' }] as const
const VEHICLES = [{ id: 'car', label: 'A car' }, { id: 'bike', label: 'A two-wheeler' }] as const
const COVERED = [
  { id: 'ownHealth', label: 'Health plan I pay for' }, { id: 'employerHealth', label: 'Health cover from my employer' },
  { id: 'ownTerm', label: 'Term plan I pay for' }, { id: 'employerLife', label: 'Life cover from my employer' }, { id: 'savingsPlan', label: 'Endowment, money-back or ULIP' },
  { id: 'ownMotor', label: 'Insurance on my vehicle' },
] as const

const STATUS: Record<NeedStatus, { label: string; cls: string }> = {
  now: { label: 'Get now', cls: 'pill--now' },
  have: { label: 'You have it', cls: 'pill--have' },
  later: { label: 'Soon', cls: 'pill--later' },
  notYet: { label: 'Not yet', cls: 'pill--notyet' },
}

const TITLES = ['About you', 'Who relies on your income?', 'What do you earn in a year?', 'Any loans you are still paying?', 'Do you own a vehicle?', 'What insurance do you already have?']

/** One question at a time: big, clear, and the next step always in the same place. */
export default function Need({ go }: { go: (to: string) => void }) {
  const { p, set, reveal } = useProfile()
  const res = computeNeeds(needsInputOf(p))
  const [asking, setAsking] = useState(!p.revealed.need)
  const [i, setI] = useState(0)
  const last = i === TITLES.length - 1

  const finish = () => { reveal('need'); setAsking(false); window.scrollTo({ top: 0 }) }
  const go1 = (n: number) => { setI(n); window.scrollTo({ top: 0 }) }
  const next = () => (last ? finish() : go1(i + 1))

  const body: ReactNode[] = [
    <div className="stack" key="about">
      <div className="stack--sm stack"><span className="label">Your age</span><Stepper label="Your age" value={p.age} min={LIMITS.age.min} max={LIMITS.age.max} unit="years" onChange={(age) => set({ age })} /></div>
      <div className="stack--sm stack"><span className="label">Gender</span><Seg label="Gender" value={p.gender} onChange={(gender) => set({ gender })} options={[{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }, { id: 'other', label: 'Other' }]} /></div>
      <div className="stack--sm stack"><span className="label">Tobacco</span><Seg label="Tobacco" value={p.smoker ? 's' : 'n'} onChange={(v) => set({ smoker: v === 's' })} options={[{ id: 'n', label: 'No tobacco' }, { id: 's', label: 'Smoke or chew' }]} /></div>
    </div>,
    <Multi<Dependent> key="deps" label="Who relies on your income" value={p.dependents} options={DEPS} none="Nobody" onChange={(dependents) => set({ dependents })} />,
    <div className="stack" key="income">
      {!p.noIncome && (
        <Money label="Yearly income, before tax" hideLabel value={p.income} min={LIMITS.income.min} max={LIMITS.income.max} step={LIMITS.income.step} why={LIMITS.income.why}
          presets={[{ label: '₹6 lakh', value: 6 * LAKH }, { label: '₹12 lakh', value: 12 * LAKH }, { label: '₹24 lakh', value: 24 * LAKH }, { label: '₹50 lakh', value: 50 * LAKH }, { label: '₹1 crore', value: CRORE }]} onChange={(income) => set({ income })} />
      )}
      <div><Chip multi on={p.noIncome} onClick={() => set({ noIncome: !p.noIncome })}>I don’t earn an income</Chip></div>
    </div>,
    <Multi<Owns> key="loans" label="Loans you are still paying" value={p.owns.filter((o) => o === 'homeLoan' || o === 'vehicleLoan' || o === 'otherLoan')} options={LOANS} none="No loans" onChange={(loans) => set({ owns: [...loans, ...p.owns.filter((o) => o === 'car' || o === 'bike')] })} />,
    <Multi<Owns> key="veh" label="Vehicles you own" value={p.owns.filter((o) => o === 'car' || o === 'bike')} options={VEHICLES} none="No vehicle" onChange={(v) => set({ owns: [...p.owns.filter((o) => o !== 'car' && o !== 'bike'), ...v] })} />,
    <Multi<Covered> key="cov" label="What covers you today" value={p.covered} options={COVERED.filter((c) => c.id !== 'ownMotor' || p.owns.includes('car') || p.owns.includes('bike'))} none="Nothing yet" onChange={(covered) => set({ covered })} />,
  ]
  const hints = [undefined, 'Include anyone who counts on your income to get by.', undefined, 'If something happened to you, your family would be left to repay it.', 'Whether or not it is on a loan.', 'Pick everything that applies.']

  if (asking) {
    return (
      <div className="shell shell--wide page flow pagepager">
        <PageHead step={1} go={go} eyebrow={`Question ${i + 1} of ${TITLES.length}`} title={TITLES[i]} />
        <div className="pager">
          <div className="pager__bar" aria-hidden="true"><span style={{ width: `${((i + 1) / TITLES.length) * 100}%` }} /></div>
          {hints[i] && <p className="hint2">{hints[i]}</p>}
          <div className="pager__body" key={i}>{body[i]}</div>
        </div>
        <div className="pagerbar">
          <button type="button" className="btn" onClick={() => go1(Math.max(0, i - 1))} disabled={i === 0} aria-disabled={i === 0}>Back</button>
          <button type="button" className="btn btn--brand" onClick={next}>{last ? 'Show what I need' : 'Next'} <Arrow /></button>
        </div>
      </div>
    )
  }

  const target = res.firstMove?.product ? `amount/${res.firstMove.product}` : 'amount'
  return (
    <div className="shell shell--wide page flow">
      <PageHead step={1} go={go} eyebrow={stageLabel[res.stage]} title={res.headline} />
      <div className="stack stack--lg">
        <ul className="needs">
          {res.needs.map((n, k) => (
            <li className="needrow" data-status={n.status} key={n.id}>
              <span className="needrow__n" aria-hidden="true">{k + 1}</span>
              <div className="needrow__b">
                <div className="needrow__h"><span className="needrow__t">{n.title}</span>{n.status !== 'now' && <span className={`pill ${STATUS[n.status].cls}`}>{STATUS[n.status].label}</span>}</div>
                <p className="needrow__r">{firstLine(n.status === 'have' ? n.reason.replace(/^You (have one|hold some)\.\s*/, '') : n.reason, 110)}</p>
              </div>
              {n.product && n.status === 'now' && <button type="button" className="needrow__go" aria-label={`Work out ${n.title}`} onClick={() => go(`amount/${n.product}`)}><Arrow /></button>}
            </li>
          ))}
        </ul>
        {res.flags.length > 0 && <Flags items={res.flags.slice(0, 2).map((text) => ({ level: 'warn' as const, text }))} />}
        <div className="row"><button type="button" className="btn btn--ghost btn--small" onClick={() => { setI(0); setAsking(true) }}>Change my answers</button></div>
        <Disclose title="How we decided">
          <p className="body small">Insurance pays for rare, huge losses you could not fund yourself. When money is tight, we buy in this order: a clean health plan for each adult (waiting periods start at purchase), term life if someone depends on your income or a loan, a health super top-up if your hospitals or health history call for one, motor, then critical illness and accident cover. Employer cover is a bonus: it ends with the job.</p>
        </Disclose>
      </div>
      <div className="pagerbar">
        <button type="button" className="btn btn--brand btn--block" onClick={() => go(target)}>{res.firstMove ? 'Work out how much' : 'Check the amounts'} <Arrow /></button>
      </div>
    </div>
  )
}
