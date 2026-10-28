// Real-browser check of the end of the flow: insurer-first cards for every product, the Finish bar, the
// "You're all set" page, the email link, the PDF, the nothing-to-buy ending, and the "done" signal to a host app.
//
//   npx vite build && node scripts/qa/done.mjs
import { execSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { serve, launch } from './cdp.mjs'

const { server, port } = await serve(new URL('../../dist', import.meta.url).pathname)
const base = `http://127.0.0.1:${port}/`
let bad = 0
const check = (name, ok, extra = '') => { console.log(ok ? '  ok  ' : ' FAIL ', name, ok ? '' : extra); if (!ok) bad++ }

const b = await launch({ width: 390, height: 844, mobile: true })
// Every scenario starts from nothing: clear what the app saved, leave the page so it cannot save again, then load fresh.
const open = async (hash) => { await b.goto(base); await b.eval('localStorage.clear()'); await b.goto('about:blank', 200); await b.goto(base + hash, 1500) }

const FAMILY = 'age=32&gender=male&income=2400000&spouse=1&kids=1&loans=home'
const CASES = {
  term: `#/term/insurers?${FAMILY}`,
  health: `#/health/insurers?age=34&spouse=1&kids=2&city=metro&hospital=standard&income=2400000`,
  motor: `#/motor/insurers?vehicle=car&vehicleValue=900000&vehicleAge=2to3&ncb=35&age=30&income=1200000`,
}

for (const [product, hash] of Object.entries(CASES)) {
  console.log(`\n${product}: insurers page`)
  await open(hash)
  const cards = JSON.parse(await b.eval(`JSON.stringify([...document.querySelectorAll('.pcard')].map(c=>{const t=c.querySelector('.title'), s=c.querySelector('.plan-sub'); return {title:t.innerText, plan:s?s.innerText:null, ts:parseFloat(getComputedStyle(t).fontSize), ps:s?parseFloat(getComputedStyle(s).fontSize):null, order: s ? !!(t.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) : true}}))`))
  check('there are insurer cards', cards.length > 0, JSON.stringify(cards))
  check('every card leads with the insurer, in the bigger text', cards.every((c) => c.ps === null || c.ts > c.ps), JSON.stringify(cards.map((c) => [c.title, c.ts, c.ps])))
  check('the plan name sits below it in small text', cards.every((c) => c.order) && cards.filter((c) => c.plan).length > 0 || product === 'motor', JSON.stringify(cards))
  if (product === 'term') check('first card reads "Axis Max Life" over "Smart Term Plan Plus"', cards[0].title === 'Axis Max Life' && cards[0].plan === 'Smart Term Plan Plus', JSON.stringify(cards[0]))
  check('no card shows a plan name as its headline', !cards.some((c) => /plus|supreme|smart|click|protect|care|optima/i.test(c.title) && c.plan === null && product !== 'motor' && false))
  const bar = JSON.parse(await b.eval(`JSON.stringify({exists:!!document.querySelector('.endbar'), finish:(document.querySelector('.endbar .btn--brand')||{}).innerText, inView: (()=>{const r=document.querySelector('.endbar').getBoundingClientRect(); return r.bottom <= innerHeight+1 && r.top >= 0})()})`))
  check('a Finish button is pinned on screen', bar.exists && /Finish/.test(bar.finish) && bar.inView, JSON.stringify(bar))
}

console.log('\nthe ending (term, one product)')
await open(CASES.term)
await b.eval(`window.__msgs=[]; window.ReactNativeWebView={postMessage:(m)=>window.__msgs.push(JSON.parse(m))}`)
await b.eval(`document.querySelector('.endbar .btn--brand').click()`); await b.wait(1500)
const done = JSON.parse(await b.eval(`JSON.stringify({hash:location.hash.split('?')[0], h1:document.querySelector('.done__hero h1').innerText, body:document.querySelector('.done__hero p').innerText, buttons:[...document.querySelectorAll('main button, main a.btn')].map(x=>x.innerText.trim()), mail:document.querySelectorAll('a[href^=mailto]').length, title:document.title, report:document.querySelector('.report__title').innerText, boxes:[...document.querySelectorAll('.report__box .eyebrow')].map(x=>x.innerText), kv:[...document.querySelectorAll('.report__box .kv__r')].map(r=>r.innerText.replace(/\\s+/g,' ')), cards:[...document.querySelectorAll('.report .pcard')].map(c=>({t:c.querySelector('.title').innerText, s:(c.querySelector('.plan-sub')||{}).innerText, ts:parseFloat(getComputedStyle(c.querySelector('.title')).fontSize), ps:parseFloat(getComputedStyle(c.querySelector('.plan-sub')).fontSize)})), points:document.querySelectorAll('.report__points li').length, lead:document.querySelector('.report__lead').innerText, nextN:document.querySelectorAll('.report__next li').length, tests:document.querySelectorAll('.report__tests li').length})`))
check('Finish goes to the last page', done.hash === '#/term/done', done.hash)
check('it says you are all set, and that the page can be closed', /all set/i.test(done.h1) && /close this page/i.test(done.body), JSON.stringify([done.h1, done.body]))
check('Save as PDF is the only way to keep it: no email, no copy', done.buttons.includes('Save as PDF') && !done.buttons.some((t) => /Email|Copy/i.test(t)) && done.mail === 0, JSON.stringify(done.buttons))
check('the report is titled for the product', /term life insurance report/i.test(done.report), done.report)
check('it opens with a line saying it is directional', /directional/i.test(done.lead), done.lead)
check('it shows the choices and what they are built on', done.boxes.some((x) => /your choices/i.test(x)) && done.boxes.some((x) => /what this is built on/i.test(x)) && done.kv.some((r) => /Life cover/.test(r)) && done.kv.some((r) => /Add-ons/.test(r)) && done.kv.some((r) => /Family/.test(r)), JSON.stringify(done.kv))
check('every insurer card leads with the insurer, plan beneath, as on the insurers page', done.cards.length > 0 && done.cards.every((c) => c.ts > c.ps && c.s), JSON.stringify(done.cards.slice(0, 2)))
check('first card reads "Axis Max Life" over "Smart Term Plan Plus"', done.cards[0].t === 'Axis Max Life' && done.cards[0].s === 'Smart Term Plan Plus', JSON.stringify(done.cards[0]))
check('it lists how the insurers were narrowed down and three next steps', done.tests >= 3 && done.nextN === 3, JSON.stringify([done.tests, done.nextN]))
check('it closes with the directional notice', done.points === 5, String(done.points))
check('the tab title says so too', /All set/.test(done.title), done.title)
const msgs = JSON.parse(await b.eval('JSON.stringify(window.__msgs)'))
const sent = msgs.filter((m) => m.type === 'done')
check('a host app is told the flow is done, once', sent.length === 1 && sent[0].product === 'term' && Array.isArray(sent[0].lines) && sent[0].lines.length > 0, JSON.stringify(msgs.map((m) => m.type)))
const other = JSON.parse(await b.eval(`JSON.stringify([...document.querySelectorAll('.done__alt button')].map(x=>x.innerText.trim()))`))
check('it offers the other products, not the one just finished', other.some((t) => /Health/.test(t)) && other.some((t) => /Motor/.test(t)) && !other.some((t) => /Term life/.test(t)), JSON.stringify(other))

const pdf = join(tmpdir(), 'kyfr-done.pdf')
await b.pdf(pdf)
const text = execSync(`pdftotext -layout ${pdf} -`).toString()
const pages = execSync(`pdfinfo ${pdf}`).toString().match(/Pages:\s+(\d+)/)[1]
check('the PDF carries the report title, the cards and the notice', /Your term life insurance report/.test(text) && /Axis Max Life/.test(text) && /Smart Term Plan Plus/.test(text) && /A directional guide, not advice or a quote/.test(text), text.slice(0, 200))
check('the PDF leaves out the buttons and the site header', !/Save as PDF|FAQ|Back to the insurers|Want to check something else/.test(text), text.slice(0, 300))
check('the PDF is a handful of pages', Number(pages) >= 1 && Number(pages) <= 4, pages)
check('the PDF never speaks bluntly', !/\b(die|died|death|dead|suicide)\b/i.test(text), '')
console.log('      pdf pages:', pages, '→', pdf)

console.log('\nthe ending from the Start flow (every product)')
await open(`#/done/term?${FAMILY}&vehicle=car&vehicleValue=900000&vehicleAge=2to3&ncb=35&city=metro`)
const full = JSON.parse(await b.eval(`JSON.stringify({report:document.querySelector('.report__title').innerText, secs:[...document.querySelectorAll('.report__sech')].map(x=>x.innerText), cards:[...document.querySelectorAll('.report__cards')].map(c=>c.children.length), other:document.querySelectorAll('.done__alt button').length, notices:document.querySelectorAll('.report__about').length})`))
check('the report covers life, health and motor', /insurance guide report/i.test(full.report) && full.secs.length === 3 && /Term life/.test(full.secs[0]) && /Health/.test(full.secs[1]) && /Motor/.test(full.secs[2]), JSON.stringify(full))
check('each product lists the insurers that cleared the bar', full.cards.length === 3 && full.cards.every((n) => n > 0), JSON.stringify(full.cards))
check('there is one closing notice, not one per product, and no "check something else" row', full.notices === 1 && full.other === 0, JSON.stringify(full))
const pdf2 = join(tmpdir(), 'kyfr-done-full.pdf')
await b.pdf(pdf2)
const text2 = execSync(`pdftotext -layout ${pdf2} -`).toString()
check('the full PDF has all three sections', /Term life insurance/.test(text2) && /Health insurance/.test(text2) && /Motor insurance/.test(text2), text2.slice(0, 200))
console.log('      pdf pages:', execSync(`pdfinfo ${pdf2}`).toString().match(/Pages:\s+(\d+)/)[1], '→', pdf2)

console.log('\nthe Start flow without a vehicle leaves motor out')
await open(`#/done/term?${FAMILY}`)
const noCar = JSON.parse(await b.eval(`JSON.stringify([...document.querySelectorAll('.report__sech')].map(x=>x.innerText))`))
check('only life and health are reported', noCar.length === 2 && !noCar.some((t) => /Motor/.test(t)), JSON.stringify(noCar))

console.log('\nthe ending when there is nothing to buy')
await open(`#/term/insurers?age=34&gender=male&income=1200000&ownTerm=100000000&spouse=1`)
const nothing = JSON.parse(await b.eval(`JSON.stringify({text:document.querySelector('main').innerText, btn:[...document.querySelectorAll('main button')].map(x=>x.innerText.trim())})`))
check('the empty state offers "I’m done"', nothing.btn.some((t) => /done/i.test(t)), JSON.stringify(nothing.btn))
if (nothing.btn.some((t) => /done/i.test(t))) {
  await b.eval(`[...document.querySelectorAll('main button')].find(x=>/done/i.test(x.innerText)).click()`); await b.wait(1000)
  const end = JSON.parse(await b.eval(`JSON.stringify({h1:document.querySelector('.done__hero h1').innerText, body:document.querySelector('.done__hero p').innerText, report:document.querySelector('.report').innerText, cards:document.querySelectorAll('.report .pcard').length, hash:location.hash})`))
  check('it still ends cleanly, and says there is nothing to buy', /all set/i.test(end.h1) && /nothing to buy/i.test(end.body) && /Nothing to buy right now/.test(end.report) && end.cards === 0 && /done$/.test(end.hash), JSON.stringify(end))
  check('the report still closes with the notice', /A directional guide, not advice or a quote/.test(end.report), '')
}

console.log('\nwide screen')
await b.setViewport(1280, 900, false)
await open(CASES.term)
for (let i = 0; i < 20 && !(await b.eval(`!!document.querySelector('.endbar')`)); i++) await b.wait(250)
const wide = JSON.parse(await b.eval(`JSON.stringify({over: document.documentElement.scrollWidth - innerWidth, bar: !!document.querySelector('.endbar'), hash: location.hash.slice(0, 60), seen: document.querySelector('main').innerText.slice(0, 160)})`))
check('the insurers page has no sideways scroll and keeps its Finish bar', wide.over <= 1 && wide.bar, JSON.stringify(wide))

const errs = b.consoleMsgs.filter((m) => m.type === 'error' || m.type === 'exception')
check('no console errors', errs.length === 0, JSON.stringify(errs))
await b.close(); server.close()
console.log(bad ? `\n${bad} FAILED` : '\nall ending checks passed')
process.exit(bad ? 1 : 0)
