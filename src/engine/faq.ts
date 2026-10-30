import { CONCEPTS, type Concept } from './knowledge'
import { EXTRA_Q } from './knowledgeBoost'

/**
 * The FAQ. Every question people ask about term and health insurance, grouped so nothing is hard to find.
 * Answers come from the same knowledge base as before; the questions below are written as a person would ask them.
 */
export interface FaqItem {
  id: string
  title: string
  a: string[]
  bullets?: string[]
  go?: { label: string; to: string }[]
  related: string[]
  /** The product flow this question belongs to, so the answer can send the customer straight into it. */
  product: 'term' | 'health' | null
  /** Lower-case text the search looks through: aliases and the answer itself. */
  haystack: string
}

export interface FaqCategory {
  id: string
  title: string
  blurb: string
  /** A category about one product offers a way straight into that product's flow. */
  product: 'term' | 'health' | null
  items: FaqItem[]
}

type Extra = { id: string; title: string; q: string[]; a: string[]; bullets?: string[]; go?: { label: string; to: string }[]; next?: string[] }
const x = (id: string, title: string, q: string[], a: string[], more: Partial<Extra> = {}): Extra => ({ id, title, q, a, ...more })

/* ───────────────────────── New questions, written to close gaps ───────────────────────── */
const EXTRA: Extra[] = [
  // Basics
  x('g_premium_sum', 'What is the difference between premium and cover (sum insured)?', ['premium vs sum insured', 'what is sum assured', 'what is cover amount', 'what is premium'],
    ['The premium is what you pay, usually every year. The cover (called sum assured in life insurance and sum insured in health) is the most the insurer will pay out. A higher cover costs more, but not in a straight line: doubling the cover costs less than double the premium.']),
  x('g_how_priced', 'How do insurers decide my premium?', ['how is premium calculated', 'why is my premium higher', 'what affects insurance premium', 'what factors decide premium'],
    ['Each product prices the risk of paying a claim.'], { bullets: ['Term life: your age, gender, tobacco use, cover amount, how long the cover runs, and sometimes health and occupation.', 'Health: the age of the eldest member, who is covered, the cover amount, your city, and any known condition.', 'Buying younger and healthier locks a lower price, which is why it pays to buy early.'] }),
  x('g_rider', 'What is a rider or an add-on?', ['what is a rider in insurance', 'what is an add on', 'extra cover on top of policy', 'optional benefit'],
    ['A rider is an optional extra bolted onto the main policy for a small extra premium. The main policy does the heavy lifting. The extras fix a specific gap, such as critical illness cover on a term plan or a super top-up on a health plan.', 'Take only the ones your situation calls for. Step 3 of this guide shows which to take, consider or skip.'], { go: [{ label: 'See my add-ons', to: 'addons' }] }),
  x('g_exclusions', 'What is not covered? What are exclusions?', ['what are exclusions', 'what does insurance not cover', 'general exclusions health insurance', 'exclusions in term insurance'],
    ['Every policy lists what it will not pay for. Read this list before you buy, because most surprises come from here.'], { bullets: ['Term life: self-harm in the first year, and claims where important facts were hidden when the policy was bought.', 'Health: cosmetic treatment, most dental and vision, injuries from hazardous sport or war, and anything inside a waiting period.'] }),
  x('g_read_policy', 'What should I check in a policy before I buy?', ['what to read in policy document', 'policy wording what to check', 'how to read insurance policy', 'what to look for in a health policy'],
    ['Read the policy wording, not the brochure. Use the 30-day free look to do it properly.'], { bullets: ['Exclusions and waiting periods.', 'For health: room-rent limit, co-pay, disease-wise sub-limits, and what counts as a pre-existing condition.', 'For term: the payout option, riders and what the claim documents are.'], next: ['g_freelook', 'g_exclusions'] }),
  x('g_docs', 'What documents do I need to buy a policy?', ['documents required to buy insurance', 'kyc for insurance', 'what proof do i need for term insurance', 'documents for health insurance'],
    ['Identity and address proof (Aadhaar or passport and PAN) are needed for all of them. Term insurers usually also ask for income proof, such as recent salary slips or income-tax returns, because they cap cover at a multiple of income. Health may ask for medical details for older applicants.']),
  x('g_medicals', 'Will I have to take a medical test?', ['do i need a medical test for term insurance', 'medical examination for insurance', 'health checkup before buying insurance', 'tele medical'],
    ['It depends on your age, cover amount and answers. Younger applicants buying a modest cover often get through on a health questionnaire alone. Larger covers and older ages usually need a medical test, paid for by the insurer. Always answer the questionnaire in full: a test does not excuse hiding something.'], { next: ['g_disclose'] }),
  x('g_ped_buy', 'Can I buy insurance if I already have a health condition?', ['can i buy health insurance with diabetes', 'insurance with pre existing condition', 'term insurance with high blood pressure', 'i have a medical condition can i get insured'],
    ['Usually yes, with conditions. A known condition may raise the premium, add a waiting period before it is covered, or be excluded for a time. Term insurers may load the price or ask for tests. Disclose everything: a policy bought honestly is worth far more than a cheaper one that is later denied.'], { next: ['h_ped', 'g_disclose', 's_hide'] }),
  x('g_insurer_fail', 'What happens if my insurer shuts down?', ['insurer goes bankrupt', 'what if insurance company fails', 'is my money safe with insurer', 'insurer collapse policy holder'],
    ['IRDAI makes every insurer hold a minimum solvency margin of 150%, and watches it. If an insurer is in trouble, the regulator can take over its management and move its policies to other insurers. This is why we show solvency in step 4: a higher ratio means a bigger cushion.'], { next: ['d_solvency'], go: [{ label: 'See insurer strength', to: 'shortlist' }] }),
  x('g_joint', 'Should my spouse and I buy one joint plan or two separate ones?', ['joint term insurance', 'joint life policy husband wife', 'two separate term plans or one'],
    ['Separate plans are usually better. Each of you gets your own cover, price and payout, and the policy does not end for one of you when the other claims. A joint plan often pays out once and then stops. Buy two plans sized to each person’s need.']),
  x('g_child_cover', 'Should I buy life insurance for my child?', ['child insurance plan', 'term insurance for kids', 'should i insure my child', 'kids insurance'],
    ['Not life insurance. A child has no income to replace. What a child needs is health cover, as part of your family floater, and your own term cover that protects their future. Plans sold as child plans are usually savings products with a small cover.'], { next: ['t_vs_endowment', 'h_floater'] }),
  // Using this guide
  x('u_how', 'How does this guide work?', ['how does this tool work', 'how to use this guide', 'what are the steps', 'where do i start'],
    ['There are four steps. Step 1 asks a few details to see which insurance fits your stage of life. Step 2 gives the cover amount and a typical premium, built from what you told us. Step 3 shows the add-ons worth paying for. Step 4 shows which insurers clear the bar on claims, complaints and strength.', 'You do not need to fill in every field. We start from sensible assumptions and show them, so you can check and change anything that is off.'], { go: [{ label: 'Start with step 1', to: 'need' }] }),
  x('u_suggested', 'What does “Suggested” mean next to my answer?', ['what does suggested mean', 'assumed value', 'why are there default values', 'what did you assume'],
    ['It marks a value we filled in because you have not given your own, such as household spending estimated from your income. It is a reasonable starting point, not a fact about you. Edit it and the tag disappears; the answer updates straight away.']),
  x('u_term_formula', 'How is my term cover calculated?', ['how do you calculate term insurance cover', 'term cover formula', 'what is the formula for life cover', 'how much cover needed formula'],
    ['Cover = what your family needs to keep its life going for the years it depends on you, plus loans and big goals, minus savings and cover you already hold.', 'Each part is shown on the answer page. The family’s yearly need is about 75% of household spending. We turn it into one sum using a conservative return on the payout and 6% inflation, so the money lasts as long as the years you choose.'], { go: [{ label: 'See my term cover', to: 'amount/term' }], next: ['t_multiple', 't_hlv'] }),
  x('u_health_formula', 'How is my health cover calculated, and why does it change with my family?', ['how do you calculate health insurance cover', 'health cover formula', 'why does my family size change cover', 'why not 1 crore health insurance'],
    ['We start with a target for one adult, based on the city and the hospitals you would use. A floater shares one limit between everyone on it, so the target grows with the people: ×(1 + 0.25 for each extra adult + 0.10 for each child, up to three), rounded to the nearest ₹5 lakh and never above ₹50 lakh.', 'The base plan comes first, ₹10 lakh for one or two people and ₹15 lakh for three or more in a city with good private hospitals. A super top-up is added only when the total goes at least ₹10 lakh above the base. Your health history and thin savings can also bring it in.'], { go: [{ label: 'See my health cover', to: 'amount/health' }], next: ['h_stack', 'h_super'] }),
  x('u_real_quotes', 'Are the premiums real quotes?', ['are these actual prices', 'is this a quote', 'how accurate is the premium', 'premium estimate or exact'],
    ['No. They are indicative ranges calibrated to published quotes and market ranges, shown without GST for individual life and health policies. The insurer sets the final price after underwriting. Use them to judge whether a quote you receive is sensible.'], { next: ['d_sources'] }),
  x('u_income_why', 'Why do you ask for my income?', ['why do you need my income', 'why income', 'does income change my cover'],
    ['Your income does not decide how much you need. It decides the most an insurer will usually sell you (a multiple of income, falling as you age) and how heavy the premium feels. We use it for those two checks, and to estimate spending and loans if you have not told us.']),
  x('u_sorted', 'What does “You are already sorted” mean?', ['already sorted meaning', 'why does it say i am sorted', 'i already have enough cover', 'ahead of target'],
    ['It means what you already hold meets, or beats, the cover we would suggest, so there is nothing to buy for that product. We then list only what is left, such as checking the policy wording or arranging cover for your parents, so the good news is not buried.']),
  x('u_not_moving', 'Why did my answer not change when I added something?', ['why is my cover not changing', 'added parents but cover same', 'added a condition nothing changed', 'answer not moving'],
    ['Some answers change the price and not the amount, and some change the amount and not the price. “What your answers changed” on each result shows, for every answer you gave, what it did to the cover and the premium. When nothing moves, it says why and what to do instead.'], { go: [{ label: 'Open my answer', to: 'amount' }] }),
  x('u_buy_here', 'Can I buy a policy through this guide?', ['can i buy insurance here', 'do you sell policies', 'where do i buy', 'buy button'],
    ['No. We do not sell or process a purchase. Use the guide to decide what and how much to buy, then buy from the insurer’s own site or a reputable aggregator, and compare the same terms on both.'], { next: ['g_online_agent', 'g_commission'] }),
  x('u_reset', 'How do I change my answers or start again?', ['clear my answers', 'start over', 'reset everything', 'delete my data'],
    ['Change any answer from the Edit button on the Amount page, or go back to step 1. Your answers live only in this browser, so you can clear them at any time.'], { go: [{ label: 'Clear my answers', to: '@reset' }] }),
  // Term
  x('t_option', 'Which term plan option should I pick: level, increasing or decreasing cover?', ['level cover vs increasing cover', 'increasing term insurance', 'decreasing term plan', 'term plan options'],
    ['Level cover keeps the same amount for the whole term and is right for most people. Increasing cover grows each year to offset inflation and costs more. Decreasing cover shrinks, matching a falling loan. Choose level unless you have a clear reason, and add cover later if your needs grow.'], { next: ['t_raise'] }),
  x('u_goals', 'Can I add goals like a house or a business?', ['add a goal term insurance', 'house goal term cover', 'plan for marriage with term insurance', 'goals in term insurance calculator', 'cover for a business loan goal'],
    ['Yes, whoever you are. In the cover step, tap Edit and add up to five goals: a house, your own wedding, a business or anything else. For each, give the cost in today’s money and the years until you need it. We inflate it to that year, discount it back, and add it to the cover, less any savings you can spare.', 'Children’s education and marriage are separate switches that appear once you add children.'], { go: [{ label: 'Check my term insurance', to: 'term' }], next: ['u_term_formula'] }),
  x('t_survive', 'What happens when my term policy ends?', ['what happens at the end of term insurance', 'do i get money back from term insurance', 'term insurance maturity'],
    ['Nothing is paid and the policy ends. That is why term is so cheap: you pay only for the protection. If you want money back, a return-of-premium plan exists but costs several times more. Most people do better buying term and investing the difference.'], { next: ['t_rop'] }),
  // Health
  x('h_deductible', 'What is a deductible?', ['what does deductible mean in health insurance', 'deductible vs co pay', 'what is a threshold in super top up'],
    ['A deductible is the amount of a year’s bills you pay (or your base plan pays) before a top-up begins to pay. A higher deductible makes a super top-up cheaper. We set it equal to your base plan, so the two meet without a gap.'], { next: ['h_super'] }),
  x('h_topup_vs_super', 'What is the difference between a top-up and a super top-up?', ['top up vs super top up', 'topup or super topup', 'which is better top up or super top up'],
    ['A plain top-up pays when a single bill passes the deductible. A super top-up adds up every bill in the year and pays once the total passes the deductible. The super top-up is the safer choice because the year’s bills accumulate, and that is what we suggest.'], { next: ['h_super', 'h_deductible'] }),
  x('h_pre_post', 'What are pre- and post-hospitalisation expenses?', ['pre and post hospitalisation cover', 'tests before admission covered', 'after discharge expenses covered'],
    ['The tests and consultations before an admission, and the medicines and follow-ups after discharge, are covered for a set number of days, commonly 30 to 60 days before and 60 to 90 days after. Check the numbers on your plan: they differ.']),
  x('h_mental', 'Is mental health treatment covered?', ['does health insurance cover depression', 'psychiatric treatment insurance', 'mental illness cover'],
    ['Yes. Under the Mental Healthcare Act, 2017, and IRDAI’s direction, insurers must cover mental illness on the same footing as physical illness. Check how the policy treats it, including any waiting period.']),
  x('h_newborn', 'Is my newborn covered?', ['baby covered in health insurance', 'newborn cover floater', 'when to add baby to health policy'],
    ['On many family floaters a newborn is covered from birth if you add them within a short window, often 90 days. Maternity cover, which pays for the delivery itself, carries its own waiting period of two to four years, so buy it before you plan a baby.'], { next: ['h_maternity'] }),
  x('h_renewal', 'Can an insurer refuse to renew my health policy?', ['will health insurance be renewed for life', 'insurer cancel my health policy', 'lifelong renewability'],
    ['Health policies are renewable for life. An insurer can refuse only for fraud or misrepresentation, not because you made claims or grew older. Premium can rise with age or when the insurer revises prices, so keep paying on time.']),
  x('h_tenure', 'Should I buy a one-year or a multi-year health policy?', ['2 year health insurance', 'long term health policy discount', 'multi year health plan'],
    ['A multi-year policy gives a discount and protects you from price changes within the period, but locks your money in and does not stop a premium revision at the next term. One-year policies are more flexible. If you choose multi-year, compare the total over the period, not the headline discount.']),
  // Claims and paperwork
  x('c_time', 'How long does a claim take to settle?', ['how many days to settle claim', 'claim settlement time', 'insurer delay in paying claim'],
    ['Insurers must settle within about 30 days of getting the last needed document, and owe interest on late payment. Cashless health claims are approved within hours. Reimbursement claims take longer, so submit complete papers the first time. Step 4 shows each insurer’s 30-day record.'], { go: [{ label: 'See settlement records', to: 'shortlist' }], next: ['d_30'] }),
  x('c_docs_health', 'What documents do I need for a health claim?', ['health claim documents', 'documents for reimbursement', 'what to submit for hospital claim'],
    ['Usually the claim form, your policy and ID, the discharge summary, all bills and receipts, the doctor’s prescription and reports, and the cancelled cheque or bank details. For cashless, the hospital’s desk sends most of this. Keep copies of everything.'], { next: ['h_cashless'] }),
  x('b_change', 'How do I change my address, nominee or contact details?', ['update nominee insurance', 'change address on policy', 'update mobile number policy'],
    ['Through the insurer’s website or app, or a written request with proof, quoting the policy number. Nominee changes must be accepted in writing by the insurer, so ask for the endorsement as proof.'], { next: ['g_nominee'] }),
  x('b_cancel', 'Can I cancel a policy mid-year and get a refund?', ['cancel insurance policy midway', 'refund on cancelling health insurance', 'surrender term policy'],
    ['After the 30-day free-look window you can usually still cancel, but the refund is smaller, based on how long the cover ran. A term policy with no savings component has nothing to surrender. Cancelling a health policy resets your waiting periods if you buy a new one, so port instead of cancelling.'], { next: ['g_freelook', 'h_port'] }),
]

const TITLES: Record<string, string> = {
  g_what: 'What is insurance, and why do I need it?',
  g_order: 'Which insurance should I buy first?',
  g_not_investment: 'Is insurance an investment?',
  g_inflation: 'Will my cover be enough in ten years? How often should I review?',
  g_online_agent: 'Should I buy online or through an agent?',
  g_multiple: 'Can I have more than one health or term policy?',
  g_bimasugam: 'What is Bima Sugam?',
  g_disclose: 'Should I tell the insurer everything?',
  g_freelook: 'What is the free-look period?',
  g_lapse: 'What happens if I miss a premium?',
  g_nominee: 'Who should be my nominee?',
  g_gst: 'Is there GST on insurance?',
  g_tax: 'Does insurance save tax?',
  g_ombudsman: 'How do I complain to the Insurance Ombudsman?',
  g_claim_rejected: 'My claim was rejected. What can I do?',
  g_who_advises: 'Are you a licensed adviser? Is this financial advice?',
  g_commission: 'How do you make money? Are you biased?',
  g_privacy: 'Is my data safe? What do you store?',
  x_who: 'Who are you?',
  t_what: 'What is term insurance?',
  t_vs_endowment: 'Why not an endowment, money-back plan or ULIP?',
  t_rop: 'Is return-of-premium worth it?',
  t_age: 'Till what age should I buy term cover?',
  t_limited: 'Limited-pay or regular-pay term plan?',
  t_smoker: 'How much more does a tobacco user pay?',
  t_women: 'Do women pay less for term insurance?',
  t_homemaker: 'Does a homemaker need term insurance?',
  t_multiple: 'How many times my income should the cover be?',
  t_hlv: 'What is human life value?',
  t_nri: 'Can an NRI buy term insurance in India?',
  t_s45: 'What is Section 45?',
  t_saral: 'What is Saral Jeevan Bima?',
  t_group: 'Is my employer’s life cover enough?',
  t_buy_early: 'When should I buy term insurance?',
  t_raise: 'Can I increase my term cover later?',
  t_ci_rider: 'Is a critical illness rider worth it?',
  t_wop: 'What is waiver of premium?',
  t_adb: 'What is an accident rider?',
  t_income_benefit: 'Should the payout be a lump sum or monthly income?',
  t_break: 'What is a premium break?',
  t_year1: 'Why is the first-year premium lower?',
  t_annual: 'Should I pay monthly or annually?',
  t_claim: 'How does my family claim term insurance?',
  t_suicide: 'What is the first-year self-harm clause?',
  t_dual: 'We both earn. How much cover does each need?',
  t_loan_cover: 'Loan insurance or term insurance?',
  t_enough: 'Is ₹1 crore of term cover enough?',
  h_what: 'What is health insurance?',
  h_stack: 'How much health insurance should I have?',
  h_super: 'What is a super top-up?',
  h_floater: 'Family floater or individual plans?',
  h_roomrent: 'What is room-rent capping?',
  h_copay: 'What is a co-pay?',
  h_sublimit: 'What are disease-wise sub-limits?',
  h_ped: 'What is the pre-existing disease waiting period?',
  h_moratorium: 'What is the moratorium period?',
  h_waits: 'Which waiting periods apply?',
  h_restore: 'What is restoration benefit?',
  h_ncb: 'What is no-claim bonus in health insurance?',
  h_consumables: 'What are consumables, and are they covered?',
  h_maternity: 'Is maternity covered?',
  h_parents: 'How should I insure my parents?',
  h_senior: 'Health insurance for senior citizens',
  h_port: 'How do I port my health policy?',
  h_cashless: 'Cashless or reimbursement?',
  h_network: 'How many network hospitals should an insurer have?',
  h_icr: 'What is incurred claim ratio?',
  h_employer: 'I have employer health cover. Do I need my own?',
  h_opd: 'Is OPD cover worth it?',
  h_ci: 'Do I need a standalone critical illness plan?',
  h_pa: 'Do I need personal accident insurance?',
  h_cash: 'Is a hospital daily cash plan worth it?',
  h_tpa: 'What is a TPA?',
  h_premium_rise: 'Why does my health premium rise every year?',
  h_young: 'Should young people buy health insurance?',
  h_ayush: 'Does health insurance cover Ayurveda and AYUSH?',
  h_daycare: 'Are day-care procedures covered?',
  d_csr: 'What is claim settlement ratio?',
  d_asr: 'What is amount settlement ratio?',
  d_30: 'What is the 30-day settlement figure?',
  d_complaints: 'What are complaints per 10,000 claims?',
  d_solvency: 'What is solvency ratio?',
  d_persistency: 'What is persistency ratio?',
  d_funnel: 'How do you shortlist insurers?',
  d_sources: 'Where does your data come from?',
  d_no_best: 'Why don’t you name one best insurer?',
  s_hide: 'Can I leave out a health condition to get a lower price?',
  s_inflate: 'Can I show a higher income to get more cover?',
  s_guarantee: 'Will my claim definitely be paid?',
}

const CATEGORIES: { id: string; title: string; blurb: string; product?: 'term' | 'health'; ids: string[] }[] = [
  { id: 'basics', title: 'Insurance basics', blurb: 'What it is, what comes first, and how prices work.',
    ids: ['g_what', 'g_order', 'g_premium_sum', 'g_how_priced', 'g_rider', 'g_exclusions', 'g_not_investment', 'g_multiple', 'g_child_cover', 'g_inflation', 'g_insurer_fail', 'g_bimasugam'] },
  { id: 'term', title: 'Term life', blurb: 'Cover for your family if you are not around.', product: 'term',
    ids: ['t_what', 't_enough', 't_multiple', 'u_term_formula', 'u_goals', 't_buy_early', 't_age', 't_option', 't_survive', 't_vs_endowment', 't_rop', 't_limited', 't_smoker', 't_women', 't_homemaker', 't_dual', 'g_joint', 't_nri', 't_group', 't_raise', 't_ci_rider', 't_wop', 't_adb', 't_income_benefit', 't_break', 't_year1', 't_annual', 't_loan_cover', 't_hlv', 't_s45', 't_suicide', 't_saral'] },
  { id: 'health', title: 'Health', blurb: 'Hospital bills, plans, waiting periods and what to read.', product: 'health',
    ids: ['h_what', 'h_stack', 'u_health_formula', 'h_super', 'h_topup_vs_super', 'h_deductible', 'h_floater', 'h_employer', 'h_young', 'h_parents', 'h_senior', 'h_maternity', 'h_newborn', 'h_roomrent', 'h_copay', 'h_sublimit', 'h_ped', 'h_moratorium', 'h_waits', 'h_restore', 'h_ncb', 'h_consumables', 'h_pre_post', 'h_daycare', 'h_ayush', 'h_mental', 'h_renewal', 'h_tenure', 'h_premium_rise', 'h_port', 'h_cashless', 'h_tpa', 'h_opd', 'h_ci', 'h_pa', 'h_cash'] },
  { id: 'claims', title: 'Claims and complaints', blurb: 'What to do when you need the insurer to pay.',
    ids: ['c_time', 'g_claim_rejected', 'h_cashless', 'c_docs_health', 't_claim', 'g_ombudsman', 's_guarantee'] },
  { id: 'paperwork', title: 'Buying and paperwork', blurb: 'Forms, documents and keeping a policy alive.',
    ids: ['g_docs', 'g_medicals', 'g_ped_buy', 'g_disclose', 'g_read_policy', 'g_freelook', 'g_online_agent', 'g_nominee', 'b_change', 'g_lapse', 'b_cancel', 's_hide', 's_inflate'] },
  { id: 'tax', title: 'Tax and GST', blurb: 'What is taxed and what is deductible.', ids: ['g_gst', 'g_tax'] },
  { id: 'insurers', title: 'Comparing insurers', blurb: 'The measures behind the insurer shortlist in step 4.',
    ids: ['d_no_best', 'd_funnel', 'd_csr', 'd_asr', 'd_30', 'd_complaints', 'd_solvency', 'd_persistency', 'h_icr', 'h_network', 'd_sources'] },
  { id: 'about', title: 'About this guide', blurb: 'How it works, what the numbers mean and what we do with your data.',
    ids: ['u_how', 'u_suggested', 'u_sorted', 'u_not_moving', 'u_real_quotes', 'u_income_why', 'u_buy_here', 'u_reset', 'x_who', 'g_who_advises', 'g_commission', 'g_privacy'] },
]

/** A step of one product goes to that product's own flow: health, health/addons, health/insurers. */
const toFlow = (to: string) => {
  const m = /^(amount|addons|shortlist)\/(term|health)$/.exec(to)
  return m ? (m[1] === 'amount' ? m[2] : `${m[2]}/${m[1] === 'addons' ? 'addons' : 'insurers'}`) : to
}
const fixGo = (go: { label: string; to: string }[] | undefined, id: string) =>
  go?.map((g) => (g.to === 'ask?q=my+claim+was+rejected' ? { ...g, to: 'faq?open=g_claim_rejected' } : g.to === 'ask?q=reset' ? { label: g.label, to: '@reset' } : { ...g, to: toFlow(g.to) }))
    .filter((g) => !(id === 'g_claim_rejected' && g.to === 'faq?open=g_claim_rejected'))

const productOf = (id: string): FaqItem['product'] => (id.startsWith('t_') ? 'term' : id.startsWith('h_') ? 'health' : null)

function build(): Map<string, FaqItem> {
  const m = new Map<string, FaqItem>()
  const put = (id: string, title: string, q: string[], a: string[], bullets: string[] | undefined, go: FaqItem['go'], next: string[] | undefined) =>
    m.set(id, { id, title, a, bullets, go: fixGo(go, id), related: next ?? [], product: productOf(id), haystack: [title, ...q, ...(EXTRA_Q[id] ?? []), ...a, ...(bullets ?? [])].join(' ').toLowerCase() })
  for (const c of CONCEPTS as Concept[]) put(c.id, TITLES[c.id] ?? c.q[0], c.q, c.a, c.bullets, c.go, c.next)
  for (const e of EXTRA) put(e.id, e.title, e.q, e.a, e.bullets, e.go, e.next)
  return m
}

const ITEMS = build()
// Concepts that exist for the old chat only (greetings, resets) are not FAQ questions.
const CHAT_ONLY = new Set(['x_hello', 'x_thanks', 'x_help', 'x_reset', 'x_bye', 's_buy', 's_medical'])
for (const id of CHAT_ONLY) ITEMS.delete(id)

export const FAQ: FaqCategory[] = CATEGORIES.map((c) => ({
  id: c.id, title: c.title, blurb: c.blurb, product: c.product ?? null,
  items: [...new Set(c.ids)].map((id) => ITEMS.get(id)).filter((x): x is FaqItem => !!x),
}))

export const faqItem = (id: string): FaqItem | undefined => ITEMS.get(id)
export const faqCategoryOf = (id: string): string | undefined => FAQ.find((c) => c.items.some((i) => i.id === id))?.id

/** Words that carry no meaning for matching. */
const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'do', 'does', 'i', 'my', 'me', 'to', 'of', 'in', 'for', 'and', 'or', 'it', 'what', 'how', 'can', 'should', 'on', 'be', 'if', 'you'])

/** Every question that contains all the meaningful words you typed, best title match first. */
export function searchFaq(query: string, limit = 30): FaqItem[] {
  const words = query.toLowerCase().replace(/[^a-z0-9₹ ]+/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w))
  if (words.length === 0) return []
  const seen = new Set<string>()
  const scored: { item: FaqItem; score: number }[] = []
  for (const c of FAQ) for (const item of c.items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    if (!words.every((w) => item.haystack.includes(w))) continue
    const t = item.title.toLowerCase()
    scored.push({ item, score: words.filter((w) => t.includes(w)).length * 2 + words.length })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.item)
}
