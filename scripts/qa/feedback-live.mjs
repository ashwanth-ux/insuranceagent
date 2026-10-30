// Drives the LIVE site in real Chrome through many ways people fill in "Was this helpful?", fully and partially, and records
// what the form showed and what Google's script replied. Every row it creates has a session id starting "qa-test-" so it is
// easy to find and delete. It sends real rows to the real sheet, so run it on purpose.
//
//   node scripts/qa/feedback-live.mjs [site-url] [--out expected.json]
import { writeFileSync } from 'node:fs'
import { launch } from './cdp.mjs'

const args = process.argv.slice(2)
const base = (args.find((a) => /^https?:/.test(a)) || 'https://kyfr-insurance-guide.vercel.app/').replace(/\/?$/, '/')
const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : null
const FAMILY = 'age=32&gender=male&income=2400000&spouse=1&kids=1&loans=home'
const HASH = { term: `#/term/done?${FAMILY}`, health: `#/health/done?${FAMILY}`, full: `#/done/term?${FAMILY}` }
const JOURNEY_NAME = { term: 'Term life', health: 'Health', full: 'Full guide' }

const b = await launch({ width: 1100, height: 900, mobile: false })
let bad = 0
const check = (name, ok, extra = '') => { console.log(ok ? '  ok  ' : ' FAIL ', name, ok ? '' : extra); if (!ok) bad++ }
const expected = [] // the rows the sheet should end up with, in the order they were created

const setDevice = (device) => (device === 'phone' ? b.setViewport(390, 844, true) : b.setViewport(1100, 900, false))
// Every scenario is a different person: clear what the browser kept, give them a recognisable session id, load the page fresh.
async function open(session, journey, device) {
  await setDevice(device)
  await b.goto(base); await b.eval('localStorage.clear()')
  if (session) await b.eval(`localStorage.setItem('kyfr-insurance-agent.session', ${JSON.stringify(session)})`)
  await b.goto('about:blank', 200); await b.goto(base + HASH[journey], 1600)
}
// Watch every request the form makes, and what Google's script answers. `fail` blocks the network on purpose.
const hook = () => b.eval(`(()=>{ window.__calls=[]; window.__block=false; const of=window.fetch.bind(window); window.fetch=async(u,i)=>{ const mode=(i&&i.mode)||'cors'; if(window.__block){ window.__calls.push({mode,error:'blocked'}); throw new TypeError('Failed to fetch') } try{ const r=await of(u,i); let body=null; try{ body=await r.clone().json() }catch(e){} window.__calls.push({mode,status:r.status,type:r.type,body}); return r }catch(e){ window.__calls.push({mode,error:String(e)}); throw e } } })()`)
const calls = async () => JSON.parse(await b.eval('JSON.stringify(window.__calls)'))
const clickIn = (text) => b.eval(`(()=>{const e=[...document.querySelectorAll('.fb button')].find(x=>x.innerText.trim()===${JSON.stringify(text)}); if(!e) return 'NOT FOUND'; e.click(); return 'ok'})()`)
const card = () => b.eval(`document.querySelector('.fb') ? document.querySelector('.fb').innerText.replace(/\\s+/g,' ') : ''`)
const typeWords = (text) => b.eval(`(()=>{const e=document.querySelector('#fb-comment'); const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; set.call(e, ${JSON.stringify(text)}); e.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'})()`)
async function untilThanked(ms = 25000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (/Thank you/.test(await card())) return Date.now() - t0; await b.wait(150) } return -1 }
const scriptSaid = async () => (await calls()).filter((c) => c.body).map((c) => c.body)

// What the sheet will hold for a response: words are trimmed and cut at 500; anything starting like a formula gets a leading apostrophe.
const cleaned = (t) => { const s = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 500); return /^[=+\-@]/.test(s) ? "'" + s : s }
const row = (session, journey, helpful, words, device, surface = 'web') => expected.push({ session, journey: JOURNEY_NAME[journey], helpful: helpful === 'yes' ? 'Yes' : 'Not really', words: cleaned(words), device: device === 'phone' ? 'Phone' : 'Computer', where: surface === 'app' ? 'In the app' : 'On the web' })

async function fill({ session, journey, device, helpful, words = '', changeMindTo, surface }) {
  await open(session, journey, device); await hook()
  if (surface === 'app') await b.eval(`window.ReactNativeWebView={postMessage:()=>{}}`)
  const label = helpful === 'yes' ? 'Yes, it helped' : 'Not really'
  if (changeMindTo) await clickIn(changeMindTo === 'yes' ? 'Yes, it helped' : 'Not really')
  await clickIn(label)
  if (words) await typeWords(words)
  const t0 = Date.now()
  await clickIn('Send')
  const took = await untilThanked()
  const said = await scriptSaid()
  return { took, said, ms: Date.now() - t0 }
}
const accepted = (r) => r.took > -1 && r.said.some((x) => x.ok === true) && !r.said.some((x) => x.ok === false)

console.log(`site: ${base}\n`)
console.log('filled in fully')
let r = await fill({ session: 'qa-test-01-term-desktop', journey: 'term', device: 'computer', helpful: 'yes', words: 'The report was clear. I would like to see ₹2 crore compared too.' })
check('1. desktop, term life, "Yes" with words: thanked, script said ok', accepted(r), JSON.stringify(r)); row('qa-test-01-term-desktop', 'term', 'yes', 'The report was clear. I would like to see ₹2 crore compared too.', 'computer'); console.log('      took', r.took, 'ms')
r = await fill({ session: 'qa-test-02-health-phone', journey: 'health', device: 'phone', helpful: 'no', words: "Could not tell which of the two plans to pick." })
check('2. phone, health, "Not really" with words: thanked, script said ok', accepted(r), JSON.stringify(r)); row('qa-test-02-health-phone', 'health', 'no', 'Could not tell which of the two plans to pick.', 'phone'); console.log('      took', r.took, 'ms')

console.log('\nfilled in partly')
r = await fill({ session: 'qa-test-03-full-rating-only', journey: 'full', device: 'computer', helpful: 'yes' })
check('3. full guide, "Yes", no words at all: thanked, script said ok', accepted(r), JSON.stringify(r)); row('qa-test-03-full-rating-only', 'full', 'yes', '', 'computer')
r = await fill({ session: 'qa-test-04-term-phone-rating-only', journey: 'term', device: 'phone', helpful: 'no' })
check('4. phone, term life, "Not really", no words: thanked, script said ok', accepted(r), JSON.stringify(r)); row('qa-test-04-term-phone-rating-only', 'term', 'no', '', 'phone')

await open('qa-test-05-abandoned', 'term', 'computer'); await hook()
await clickIn('Yes, it helped'); await typeWords('I started writing this but never pressed Send')
await b.wait(2500)
check('5. picked "Yes" and typed words but never pressed Send: nothing is sent', (await calls()).length === 0 && !/Thank you/.test(await card()), JSON.stringify(await calls()))
await open('qa-test-06-just-looked', 'health', 'computer'); await hook(); await b.wait(2500)
check('6. opened the last page and left: nothing is sent', (await calls()).length === 0, JSON.stringify(await calls()))

await open('qa-test-07-changed-mind', 'term', 'computer'); await hook()
await clickIn('Yes, it helped'); await clickIn('Not really'); await typeWords('On reflection it was missing the health side.'); await clickIn('Send'); await untilThanked()
check('7. chose "Yes", changed to "Not really", then sent: one response, with the final choice', (await calls()).filter((c) => c.body).length >= 1 && (await card()).includes('Thank you'), JSON.stringify(await calls())); row('qa-test-07-changed-mind', 'term', 'no', 'On reflection it was missing the health side.', 'computer')

console.log('\ncoming back and doing it twice')
await b.eval('location.reload()'); await b.wait(1800); await hook()
check('8. reloading after sending: the thanks stays and the question is not asked again', /Thank you/.test(await card()) && !/Was this helpful/.test(await card()) && (await calls()).length === 0, await card())

await open('qa-test-09-two-journeys', 'term', 'computer'); await hook()
await clickIn('Yes, it helped'); await typeWords('Useful for term life.'); await clickIn('Send'); const ta = await untilThanked(); const sa = await scriptSaid(); row('qa-test-09-two-journeys', 'term', 'yes', 'Useful for term life.', 'computer')
await b.goto(base + HASH.health, 600); await b.eval('location.reload()'); await b.wait(1800); await hook()
const askedAgain = /Was this helpful/.test(await card())
await clickIn('Not really'); await typeWords("Missing a plan for my parents."); await clickIn('Send'); const tb = await untilThanked(); const sb = await scriptSaid(); row('qa-test-09-two-journeys', 'health', 'no', "Missing a plan for my parents.", 'computer')
check('9. one person, two journeys: each is asked and each gets its own row', ta > -1 && tb > -1 && askedAgain && sa.some((x) => x.ok) && sb.some((x) => x.ok), JSON.stringify({ ta, tb, askedAgain, sa, sb }))

console.log('\nawkward words')
const long = 'This is a very long answer. '.repeat(30)
r = await fill({ session: 'qa-test-10-very-long', journey: 'term', device: 'computer', helpful: 'yes', words: long })
check('10. 840 characters pasted: accepted (the sheet keeps 500)', accepted(r), JSON.stringify(r)); row('qa-test-10-very-long', 'term', 'yes', long, 'computer')
const formula = '=HYPERLINK("http://example.com","click me")'
r = await fill({ session: 'qa-test-11a-formula', journey: 'term', device: 'computer', helpful: 'yes', words: formula })
check('11a. words that look like a spreadsheet formula: accepted, and stored as plain text', accepted(r), JSON.stringify(r)); row('qa-test-11a-formula', 'term', 'yes', formula, 'computer')
const nasty = `<script>alert(1)</script> "quotes", commas; semi\nsecond line\n\n\n\nafter blank lines`
r = await fill({ session: 'qa-test-11b-symbols', journey: 'health', device: 'computer', helpful: 'no', words: nasty })
check('11b. tags, quotes, commas and line breaks: accepted', accepted(r), JSON.stringify(r)); row('qa-test-11b-symbols', 'health', 'no', nasty, 'computer')
const hindi = 'बहुत उपयोगी 👍 ₹50 लाख का कवर समझ आया'
r = await fill({ session: 'qa-test-11c-hindi-emoji', journey: 'full', device: 'computer', helpful: 'yes', words: hindi })
check('11c. Hindi, a rupee amount and an emoji: accepted', accepted(r), JSON.stringify(r)); row('qa-test-11c-hindi-emoji', 'full', 'yes', hindi, 'computer')

console.log('\nreal-life hiccups')
r = await fill({ session: 'qa-test-12-in-app', journey: 'health', device: 'phone', helpful: 'yes', words: 'Opened inside the KYFR app.', surface: 'app' })
check('12. phone, inside the app: accepted', accepted(r), JSON.stringify(r)); row('qa-test-12-in-app', 'health', 'yes', 'Opened inside the KYFR app.', 'phone', 'app')

await open('qa-test-13-offline-then-retry', 'health', 'phone'); await hook()
await clickIn('Not really'); await typeWords('Sent while the connection was down.')
await b.eval('window.__block=true'); await clickIn('Send'); await b.wait(2500)
const failedCard = await card(); const wordsKept = await b.eval(`document.querySelector('#fb-comment') ? document.querySelector('#fb-comment').value : null`)
check('13a. connection down: the form says it could not send and keeps the words', /could not send that/.test(failedCard) && /Try again/.test(failedCard) && wordsKept === 'Sent while the connection was down.', failedCard)
await b.eval('window.__block=false'); await clickIn('Try again'); const tr = await untilThanked(); const sr = await scriptSaid()
check('13b. connection back, "Try again": thanked, script said ok', tr > -1 && sr.some((x) => x.ok === true), JSON.stringify({ tr, sr })); row('qa-test-13-offline-then-retry', 'health', 'no', 'Sent while the connection was down.', 'phone')

await open('qa-test-14-double-tap', 'term', 'computer'); await hook()
await clickIn('Yes, it helped'); await typeWords('Tapped Send twice by accident.')
await b.eval(`(()=>{const e=[...document.querySelectorAll('.fb button')].find(x=>x.innerText.trim()==='Send'); e.click(); e.click(); e.click()})()`)
await untilThanked(); await b.wait(4000)
const dt = await calls()
check('14. Send tapped three times at once: thanked, and only one request leaves the page', /Thank you/.test(await card()) && dt.length === 1 && dt[0].body && dt[0].body.ok === true, JSON.stringify(dt))
row('qa-test-14-double-tap', 'term', 'yes', 'Tapped Send twice by accident.', 'computer')

const errs = b.consoleMsgs.filter((m) => (m.type === 'error' || m.type === 'exception') && !/Failed to load resource|Failed to fetch/.test(JSON.stringify(m)))
check('no unexpected console errors', errs.length === 0, JSON.stringify(errs))
await b.close()

if (outFile) writeFileSync(outFile, JSON.stringify(expected, null, 1))
console.log(`\n${expected.length} rows should now be in the sheet, all with a Session starting "qa-test-" (plus the one earlier deploy test).`)
console.log(bad ? `${bad} FAILED` : 'every scenario behaved')
process.exit(bad ? 1 : 0)
