import { bundleFor, type Bundle } from './bundles'
import { inr, inrFull } from './format'
import { computeHealth } from './health'
import { computeMotor } from './motor'
import { computeTerm } from './term'
import { healthStanding, motorStanding, termStanding } from './standing'
import { effectiveParentSupport, healthInputOf, hasLoanFlag, kidsOf, motorInputOf, termInputOf } from '../state/derive'
import type { Product } from '../state/profile'
import { sanitize, type Profile } from '../state/profile'

/**
 * "What your answers changed." For every answer the user has set, re-run the calculation with that answer switched off and report
 * what moved: the cover, the premium, the add-ons. Where nothing moved, say why, and say what to do instead.
 */
export interface Impact {
  id: string
  label: string
  /** Cover moved, premium moved, or an add-on appeared. */
  moved: boolean
  /** True when this answer is something the user has already achieved and should be credited for. */
  win: boolean
  coverLine: string
  coverMoved: boolean
  premiumLine: string
  premiumDelta: number
  addons: string[]
  why: string
  todo: string[]
}

interface Ctx {
  p: Profile
  on: Bundle
  off: Bundle | null
  offP: Profile | null
  coverDelta: number
  premiumDelta: number
  newTakes: string[]
}

interface Factor {
  id: string
  label: string
  active: (p: Profile) => boolean
  /** The profile with this answer switched off. Omit for answers that never feed a calculation. */
  off?: (p: Profile) => Partial<Profile>
  why: (c: Ctx) => string
  todo?: (c: Ctx) => string[]
  /** Shown in place of the cover line when the answer is not an input to the cover at all. */
  coverNote?: string
  /** Credit for something the user already has: replaces the cover and premium lines. */
  win?: (c: Ctx) => { cover: string; premium: string } | null
}

const up = (n: number) => `${n > 0 ? '+' : '−'}${inrFull(Math.abs(Math.round(n)))}`

/* ───────────────────────── TERM ───────────────────────── */
const TERM: Factor[] = [
  { id: 'spouse', label: 'Spouse or partner depends on you', active: (p) => p.dependents.includes('spouse'), off: (p) => ({ dependents: p.dependents.filter((d) => d !== 'spouse') }),
    why: () => 'Your spouse’s living costs, for the years they would need support, are usually the largest part of the cover.', todo: () => ['Name your spouse as the nominee, and keep it current.'] },
  { id: 'spouseEarns', label: 'Your spouse earns', active: (p) => p.dependents.includes('spouse') && p.spouseEarns, off: () => ({ spouseEarns: false }),
    why: (c) => c.coverDelta < 0 ? 'A working spouse covers about half the household’s spending, so your family needs less from your policy. Each of you still covers the shared loans.' : 'Your cover is already set by other factors.', todo: () => ['Make sure your spouse holds their own term cover for the shared loans.'] },
  { id: 'children', label: 'Children', active: (p) => p.dependents.includes('children'), off: (p) => ({ dependents: p.dependents.filter((d) => d !== 'children') }),
    why: () => 'Children lengthen the years your family needs support, and add education and marriage goals.', todo: () => ['Review cover when another child arrives, or use a plan with a life-stage option.'] },
  { id: 'parents', label: 'Parents depend on you', active: (p) => p.dependents.includes('parents'), off: (p) => ({ dependents: p.dependents.filter((d) => d !== 'parents') }),
    why: (c) => c.coverDelta > 0 ? `We added what you send them (${inrFull(effectiveParentSupport(c.p))} a month) for the years they are likely to need it. If that is already inside your household spending, set it to zero so it is not counted twice.` : 'Their support is already inside the cover, or set to zero.',
    todo: (c) => [`Check the monthly support amount in question 1 (now ${inrFull(effectiveParentSupport(c.p))}).`, 'Their health cover matters more than yours here: see the health tab.'] },
  { id: 'loans', label: 'Loans outstanding', active: (p) => hasLoanFlag(p), off: (p) => ({ owns: p.owns.filter((o) => o !== 'homeLoan' && o !== 'vehicleLoan' && o !== 'otherLoan') }),
    why: () => 'Loans are added in full, so your family is never left servicing a debt without your income.', todo: () => ['Skip bank “loan protection” plans. They pay the lender, not your family.'] },
  { id: 'goals', label: 'Big goals', active: (p) => (kidsOf(p) > 0 && (p.goalEducation || p.goalMarriage)) || p.goals.length > 0, off: () => ({ goalEducation: false, goalMarriage: false, goals: [] }),
    why: () => 'We inflate today’s cost to the year it is needed, then discount it back at a conservative return.', todo: () => ['Fund the goals with separate investments over time. The term cover is the back-up if you are not there.'] },
  { id: 'savings', label: 'Savings you could spare', active: (p) => p.freeSavings > 0, off: () => ({ freeSavings: 0 }),
    why: (c) => c.coverDelta < 0 ? 'Savings are subtracted: your family would draw on them before the policy.' : 'Too small to change the cover.', todo: (c) => (c.newTakes.length === 0 ? [] : ['Larger savings can let you skip the critical illness cover, so check the add-ons tab.']) },
  { id: 'existingTerm', label: 'Term cover you already hold', active: (p) => p.covered.includes('ownTerm') && p.existingTerm > 0, off: (p) => ({ covered: p.covered.filter((c) => c !== 'ownTerm'), existingTerm: 0 }),
    win: (c) => { const s = termStanding(c.p); return s.kind === 'sorted' ? { cover: 'You are covered: nothing to add', premium: `Premium: saves about ${inrFull(Math.abs(Math.round(c.premiumDelta)))} a year` } : null },
    why: (c) => termStanding(c.p).kind === 'sorted' ? termStanding(c.p).sub : 'What you hold is subtracted, so the cover shown is what you would add.', todo: () => ['Check that your existing plan runs long enough and has a waiver of premium.'] },
  { id: 'income', label: 'Your income', active: (p) => !p.noIncome, coverNote: 'Cover: not set by income',
    why: (c) => `Income does not set what you need. It caps what an insurer will sell you (about ${computeTerm(termInputOf(c.p)).eligibility.multiple}× income at your age, roughly ${inr(computeTerm(termInputOf(c.p)).eligibility.ceiling)}) and sets how heavy the premium feels.`,
    todo: (c) => (computeTerm(termInputOf(c.p)).eligibility.binding ? ['Your need is above that ceiling: buy in stages, add a second insurer, or use your spouse’s cover. Never inflate declared income.'] : ['Keep income proof (salary slips, ITR) ready: insurers ask for it.']) },
  { id: 'noIncome', label: 'You do not earn an income', active: (p) => p.noIncome, off: () => ({ noIncome: false }),
    why: () => 'Cover replaces the cost of your work (childcare, help, running the home), not an income. Education and marriage goals are left to your earning spouse’s cover so they are not counted twice.', todo: () => ['Ask the insurer about its cap: it is usually a share of your earning spouse’s cover.'] },
  { id: 'smoker', label: 'You use tobacco', active: (p) => p.smoker, off: () => ({ smoker: false }),
    why: () => 'Tobacco users pay about 60% to 100% more. It changes the price, not the cover you need.', todo: () => ['Declare it honestly: nicotine is detectable, and a hidden fact can sink a claim.', 'Most plans reprice you as a non-smoker after a tobacco-free period of 12 to 24 months.'] },
  { id: 'female', label: 'You are a woman', active: (p) => p.gender === 'female', off: () => ({ gender: 'male' }),
    why: () => 'Women pay about 15% less for the same cover. It changes the price, not the amount.' },
  { id: 'employerLife', label: 'Life cover through your employer', active: (p) => p.covered.includes('employerLife'), coverNote: 'Cover: not counted',
    why: () => 'It ends when the job does, often when you can least afford to be uninsured, so we count it as zero.', todo: () => ['Treat it as a bonus. Your own term plan is the one that stays.'] },
  { id: 'familyHistory', label: 'Serious illness in your family', active: (p) => p.familyHistory, off: () => ({ familyHistory: false }),
    why: (c) => c.newTakes.length ? 'It does not change the death cover. It makes critical illness cover worth taking, which adds a small premium.' : 'It does not change the death cover. It strengthens the case for critical illness cover, which was already on your list.', todo: () => ['Prefer an additional (stand-on-top) critical illness cover over an accelerated one.', 'Disclose family history when asked.'] },
  { id: 'heavyCommute', label: 'Heavy commute or travel', active: (p) => p.heavyCommute, off: () => ({ heavyCommute: false }), coverNote: 'Cover: unchanged',
    why: () => 'It does not change your need. It makes an accidental death benefit worth considering if it costs under about 10% of the base premium.', todo: () => ['A standalone personal accident plan is usually better value than the rider.'] },
  { id: 'lumpSum', label: 'The person receiving the money may not manage a lump sum', active: (p) => p.dependents.length > 0 && p.lumpSum !== 'yes', off: () => ({ lumpSum: 'yes' }), coverNote: 'Cover: unchanged',
    why: () => 'It changes how the money is paid, not how much. Monthly income or lump sum plus monthly protects someone not used to a large sum.', todo: () => ['Ask each insurer for the payout option and compare the price. Inflation erodes long monthly payouts.'] },
]

/* ───────────────────────── HEALTH ───────────────────────── */
const hOf = (p: Profile) => computeHealth(healthInputOf(p))
const topUpSize = (p: Profile | null) => { if (!p) return 0; const h = hOf(p); return h.topUp.recommended ? h.topUp.size : 0 }
/** What the answer did to the super top-up we suggest in the next step. */
const topUpNote = (c: Ctx) => {
  const d = topUpSize(c.p) - topUpSize(c.offP)
  return d > 0 ? ` The super top-up we suggest in the next step ${topUpSize(c.offP) === 0 ? `appears: ${inr(topUpSize(c.p))}` : `goes up ${inr(d)}, to ${inr(topUpSize(c.p))}`}.` : d < 0 ? ` The suggested super top-up comes down by ${inr(-d)}.` : ''
}
const baseWhy = (c: Ctx, shared: string) => c.coverDelta > 0 ? `Base cover goes up ${inr(c.coverDelta)} to ${inr(c.on.cover)}: ${shared}` : `Base cover stays ${inr(c.on.cover)}: ${shared}`
const HEALTH: Factor[] = [
  { id: 'spouse', label: 'Spouse or partner on the plan', active: (p) => p.dependents.includes('spouse'), off: (p) => ({ dependents: p.dependents.filter((d) => d !== 'spouse') }),
    why: (c) => `${baseWhy(c, c.coverDelta > 0 ? 'three people sharing one floater start at a higher base.' : 'two people share one floater limit.')} Another adult raises the family premium.${topUpNote(c)}`, todo: () => ['Put both of you on one floater.'] },
  { id: 'children', label: 'Children on the plan', active: (p) => kidsOf(p) > 0, off: (p) => ({ dependents: p.dependents.filter((d) => d !== 'children') }),
    why: (c) => `${baseWhy(c, c.coverDelta > 0 ? 'three or more people sharing one floater start at a higher base.' : 'children share the floater’s limit.')} Each child adds about 15% to the floater premium.${topUpNote(c)}`, todo: () => ['Children share the floater. Do not buy separate plans for them unless the floater limit worries you.'] },
  { id: 'babyPlanned', label: 'A baby in the next few years', active: (p) => p.babyPlanned, off: () => ({ babyPlanned: false }),
    why: (c) => `We count the baby as another person on the plan. ${baseWhy(c, c.coverDelta > 0 ? 'the floater now starts higher.' : 'one floater limit still serves everyone.')} A delivery costs about ₹0.6 to ₹2 lakh in a metro, which the base plan absorbs. The premium rises for the extra person.${topUpNote(c)} Maternity cover is an add-on.`,
    todo: () => ['Buy maternity cover now: it carries a two to four year waiting period, so a plan bought after you are pregnant will not pay for the delivery.', 'Check the maternity limit and whether newborn cover starts from day one.'] },
  { id: 'parents', label: 'Parents', active: (p) => p.dependents.includes('parents'), off: (p) => ({ dependents: p.dependents.filter((d) => d !== 'parents') }),
    why: (c) => { const bp = hOf(c.p).basePlans; return `Each parent gets their own ${inr(bp.parents?.each ?? 0)} plan, so base cover goes up ${inr(c.coverDelta)} to ${inr(c.on.cover)} across ${bp.planCount} plans. Your family’s plan is unchanged: parents stay separate so their claims never use up its limit.` },
    todo: (c) => [`Buy each parent a separate individual or senior-citizen plan (${inr(hOf(c.p).basePlans.parents?.each ?? 0)} each).`, 'Expect higher premiums and possibly a co-pay. A 10 to 20% voluntary co-pay on their plan lowers the cost.', 'Buy as early as possible: their waiting periods start only at purchase.'] },
  { id: 'knownCondition', label: 'A known health condition', active: (p) => p.knownCondition, off: () => ({ knownCondition: false }),
    why: (c) => `Base cover stays ${inr(c.on.cover)}.${topUpNote(c) || ' A super top-up was already suggested.'} A condition also loads the premium by about 15 to 30%, and may be excluded for up to 36 months.`,
    todo: () => ['Disclose it on the form. After 60 months of continuous cover an insurer cannot reject a claim for non-disclosure, except fraud.', 'Compare how many months each insurer waits for existing conditions, and consider the add-on that shortens it.', 'Do not let the policy lapse: that restarts the clocks.'] },
  { id: 'familyHistory', label: 'Serious illness in your family', active: (p) => p.familyHistory, off: () => ({ familyHistory: false }),
    why: (c) => `Base cover stays ${inr(c.on.cover)}.${topUpNote(c) || ' A super top-up was already suggested.'} Insurers do not usually price family history, so the base premium does not change. A lump sum on diagnosis (critical illness cover) is worth a look too.`,
    todo: () => ['Consider a standalone critical illness plan once the base plan is in place.', 'Compare the illness count (20 or more) and the survival period (shorter is better).'] },
  { id: 'selfEmployed', label: 'Self-employed or gig work', active: (p) => p.selfEmployed, off: () => ({ selfEmployed: false }),
    why: (c) => `Base cover stays ${inr(c.on.cover)}. With no employer plan and no sick leave, an injury also stops your income, which health insurance does not replace.`, todo: () => ['Add personal accident cover for disability benefits.', 'Keep your own individual plan: there is no group cover to fall back on.'] },
  { id: 'ownCover', label: 'Health cover you already hold', active: (p) => p.covered.includes('ownHealth') && p.ownCover > 0, off: (p) => ({ covered: p.covered.filter((c) => c !== 'ownHealth'), ownCover: 0 }),
    win: (c) => { const s = healthStanding(c.p); return s.kind === 'sorted' ? { cover: s.have > s.target ? `You are ${inr(s.have - s.target)} above the base` : 'You are at the base', premium: 'Premium: nothing to buy for yourself' } : null },
    why: (c) => healthStanding(c.p).kind === 'sorted' ? healthStanding(c.p).sub : `You hold ${inr(c.p.ownCover)}; a clean base for your family is ${inr(hOf(c.p).base)}. Raise the sum insured at renewal, or cover the gap with a super top-up in the next step.`,
    todo: (c) => healthStanding(c.p).kind === 'sorted' ? ['Read your policy for a room-rent cap, a co-pay and disease sub-limits.'] : ['If your current plan has a room-rent cap or co-pay, replace it before adding a top-up: the top-up inherits its weakness.'] },
  { id: 'employerCover', label: 'Health cover from your employer', active: (p) => p.covered.includes('employerHealth') && p.employerCover > 0, coverNote: 'Cover: not counted',
    why: () => 'It ends when the job does, and a new plan’s waiting periods start only when you buy it, so we size your own plan as if the employer cover did not exist.', todo: () => ['Buy your own base plan now, while the employer plan keeps you covered, so your waiting periods are already running.'] },
  { id: 'savingsForBill', label: 'A hospital bill you could pay from savings', active: (p) => p.savingsForBill >= 20 * 100_000 || p.savingsForBill < 5 * 100_000, off: () => ({ savingsForBill: 5 * 100_000 }),
    why: (c) => `${topUpSize(c.p) - topUpSize(c.offP) > 0 ? `With ${inr(c.p.savingsForBill)} to hand you could not absorb a big gap above the base plan.${topUpNote(c)}` : `Base cover stays ${inr(c.on.cover)}: savings set how big a deductible you can carry, not the base.`}${hOf(c.p).deductibleOption ? ` With ${inr(c.p.savingsForBill)} you could take a ${inr(hOf(c.p).deductibleOption!.deductible)} deductible on a super top-up and save about ${inrFull(hOf(c.p).deductibleOption!.saves)} a year.` : ''}`,
    todo: (c) => hOf(c.p).deductibleOption ? [`Option: a ${inr(hOf(c.p).deductibleOption!.deductible)} deductible on the super top-up. You would pay the ${inr(hOf(c.p).deductibleOption!.yourShare)} between your base plan and the deductible yourself in a bad year.`] : ['Keep the deductible equal to your base plan, so there is no gap between the two.'] },
  { id: 'income', label: 'Your income', active: (p) => !p.noIncome, coverNote: 'Cover: not set by income',
    why: (c) => hOf(c.p).trimmed ? 'Income did move something: your premiums would be heavy for it, so the super top-up is left for later.' : `Base cover stays ${inr(c.on.cover)}. Income only matters if premiums become heavy: above about 8% of income we leave the super top-up for later. Yours is about ${hOf(c.p).premiumPctOfIncome.toFixed(1)}%.`,
    todo: (c) => (hOf(c.p).trimmed ? ['Add the super top-up as income grows: it is the cheapest cover per rupee.'] : ['Pay the premium annually, not monthly, where the insurer offers a discount.', 'Revisit the amount every three to five years: hospital costs rise about 11 to 14% a year.']) },
  { id: 'hospital', label: 'The hospitals you would use', active: () => true, off: (p) => ({ hospital: p.hospital === 'local' ? 'standard' : 'local' }),
    why: (c) => `${c.coverDelta !== 0 ? `Base cover ${c.coverDelta > 0 ? 'goes up' : 'comes down'} ${inr(Math.abs(c.coverDelta))} to ${inr(c.on.cover)}: top private hospitals bill more even for ordinary admissions.` : `Base cover stays ${inr(c.on.cover)}.`}${topUpNote(c)} Top private hospitals in a metro can cost several times a local hospital.`, todo: () => ['Find three hospitals near you that you would use on the insurer’s list and confirm they are cashless.'] },
]

/* ───────────────────────── MOTOR ───────────────────────── */
const MOTOR: Factor[] = [
  { id: 'ownMotor', label: 'Insurance you already hold on the vehicle', active: (p) => p.covered.includes('ownMotor'), coverNote: 'Cover: your policy counts',
    win: (c) => (motorStanding(c.p).kind === 'sorted' ? { cover: c.p.motorPolicy === 'comprehensive' ? 'You hold comprehensive cover' : 'You hold third-party cover', premium: 'Premium: nothing to buy' } : null),
    why: (c) => (motorStanding(c.p).kind === 'sorted' ? motorStanding(c.p).sub : 'You hold third-party cover only, which is the legal minimum. It pays for damage you cause to others, not for your own vehicle. Comprehensive adds own-damage, theft and fire.'),
    todo: (c) => (motorStanding(c.p).kind === 'sorted' ? ['Check the insured value and the add-ons on your policy against what we suggest.'] : ['At renewal, switch to comprehensive. Your vehicle is young or on a loan, so the own-damage part is worth its price.']) },
  { id: 'onLoan', label: 'The vehicle is on a loan', active: (p) => p.owns.includes('vehicleLoan'), off: (p) => ({ owns: p.owns.filter((o) => o !== 'vehicleLoan') }),
    why: (c) => `Your insured value stays ${inr(c.on.cover)}: it follows the vehicle’s market value. A loan decides the type of cover: the lender expects comprehensive, and return to invoice matters if it is written off.`, todo: () => ['Keep the policy active for the whole loan, and tell the lender about renewals.'] },
  { id: 'couldReplace', label: 'You could replace it from savings', active: (p) => p.couldReplace, off: () => ({ couldReplace: false }), coverNote: 'Cover: unchanged',
    why: (c) => { const m = computeMotor(motorInputOf(c.p)); return m.recommended === 'comprehensive' ? 'Third-party only is reasonable only for an old vehicle with no loan that you could replace. This one is under five years old or on a loan, so comprehensive stays the advice whatever your savings.' : 'This is why third-party only is a reasonable choice for this vehicle: you could absorb the loss yourself.' },
    todo: (c) => (computeMotor(motorInputOf(c.p)).recommended === 'comprehensive' ? ['Keep comprehensive while the vehicle is young or on a loan. Revisit third-party only once it is over five years old and loan-free.'] : ['Third-party cover is the law. Keep it running and accept you pay your own damage.']) },
  { id: 'floodProne', label: 'You drive or park in a flood-prone area', active: (p) => p.floodProne, off: () => ({ floodProne: false }),
    why: () => 'It does not change the insured value. It makes engine protect worth taking, and water damage to the engine is the claim most often refused without it.', todo: () => ['After flooding, never restart the engine. It can void the claim.'] },
  { id: 'highwayHeavy', label: 'Long highway runs', active: (p) => p.highwayHeavy, off: () => ({ highwayHeavy: false }),
    why: () => 'It does not change the insured value or the premium we show. It makes roadside assistance worth considering, at about ₹300 to ₹800 a year.', todo: () => ['Check whether the maker or your credit card already gives roadside help, so you do not pay twice.'] },
  { id: 'streetParking', label: 'Street parking', active: (p) => p.streetParking, coverNote: 'Cover: unchanged',
    why: () => 'It raises the chance of theft and dents, but insurers price it through your pincode, not through anything we can see, so it does not move our numbers.', todo: () => ['Set the insured value honestly: theft pays the IDV, and a lowered IDV cuts your payout.', 'Zero depreciation and NCB protect matter more if you expect dents.'] },
  { id: 'ncb', label: 'Your no-claim bonus', active: (p) => p.ncb > 0, off: () => ({ ncb: 0 }),
    why: () => 'It does not change the insured value. It discounts the own-damage premium, up to 50% after five claim-free years.', todo: (c) => (c.p.ncb >= 35 ? ['A claim would wipe it out. NCB protect keeps it, usually for one claim a year.', 'Keep the NCB certificate, and renew within about 90 days of expiry or it is lost.'] : ['Keep the NCB certificate, and renew within about 90 days of expiry.']) },
  { id: 'claimSmallDents', label: 'You would claim small dents', active: (p) => p.claimSmallDents && p.ncb >= 35, off: () => ({ claimSmallDents: false }), coverNote: 'Cover: unchanged',
    why: () => 'It does not move any number. It is a warning: a small claim can wipe out a large bonus.', todo: () => ['If a repair costs less than the discount you would lose over the next few years, pay it yourself.'] },
  { id: 'carriesPassengers', label: 'You carry passengers often', active: (p) => p.carriesPassengers, off: () => ({ carriesPassengers: false }),
    why: () => 'It does not change the insured value. It makes passenger accident cover worth taking. The premium is small and set per seat, so we do not put a figure on it.', todo: () => ['Ask for passenger cover on the quote, and check the amount per seat.'] },
  { id: 'hasPA15L', label: 'You already hold a ₹15 lakh accident plan', active: (p) => p.hasPA15L, off: () => ({ hasPA15L: false }), coverNote: 'Cover: unchanged',
    why: () => 'The compulsory owner-driver accident cover can be waived, which trims the premium slightly.', todo: () => ['Give the insurer proof of the existing policy when you ask for the waiver.'] },
]

const FACTORS: Record<Product, Factor[]> = { term: TERM, health: HEALTH, motor: MOTOR }

export function impactsFor(product: Product, p: Profile): Impact[] {
  const on = bundleFor(product, p)
  const out: Impact[] = []
  for (const f of FACTORS[product]) {
    if (!f.active(p)) continue
    const offP = f.off ? sanitize({ ...p, ...f.off(p) }) : null
    const off = offP ? bundleFor(product, offP) : null
    const coverDelta = off ? on.cover - off.cover : 0
    const premiumDelta = off ? on.premium - off.premium : 0
    const newTakes = off ? on.takes.filter((x) => !off.takes.includes(x)) : []
    const droppedTakes = off ? off.takes.filter((x) => !on.takes.includes(x)) : []
    const ctx: Ctx = { p, on, off, offP, coverDelta, premiumDelta, newTakes }
    const coverMoved = Math.abs(coverDelta) >= 1
    const premMoved = Math.abs(premiumDelta) >= 100
    const coverLine = f.coverNote ?? (coverMoved ? `Cover: ${coverDelta > 0 ? 'up' : 'down'} ${inr(Math.abs(coverDelta))} to ${inr(on.cover)}` : `Cover: stays ${inr(on.cover)}`)
    const premiumLine = !off ? 'Premium: not affected' : premMoved ? `Premium: ${up(premiumDelta)} a year` : 'Premium: no change'
    const credit = f.win ? f.win(ctx) : null
    const todo = [...(f.todo ? f.todo(ctx) : []), ...newTakes.map((t) => `Add: ${t}`), ...droppedTakes.map((t) => `Now optional: ${t}`)]
    out.push({ id: f.id, label: f.label, win: !!credit || (premiumDelta <= -100 && (f.id === 'ncb' || f.id === 'hasPA15L')), moved: !!credit || coverMoved || premMoved || newTakes.length > 0 || droppedTakes.length > 0, coverLine: credit?.cover ?? coverLine, coverMoved, premiumLine: credit?.premium ?? premiumLine, premiumDelta, addons: newTakes, why: f.why(ctx), todo })
  }
  // Things the user has already achieved first, then answers that moved something, then the ones that did not (the ones people worry about).
  return out.sort((a, b) => Number(b.win) - Number(a.win) || Number(b.moved) - Number(a.moved))
}
