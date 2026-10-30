// Real-browser check of "Was this helpful?": builds a copy of the guide wired to a local stand-in for the Google Sheet web app,
// then uses the form the way a person would, including a failed send and a retry.
//
//   node scripts/qa/feedback.mjs
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { serve, launch } from './cdp.mjs'

const received = []
let failNext = 0
const mock = createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', 'application/json')
    if (failNext > 0) { failNext--; res.statusCode = 500; res.end('{"ok":false}'); return }
    try { received.push(JSON.parse(body)) } catch { /* ignore */ }
    res.end('{"ok":true}')
  })
})
await new Promise((r) => mock.listen(0, '127.0.0.1', r))
const hook = `http://127.0.0.1:${mock.address().port}/exec`

const out = mkdtempSync(join(tmpdir(), 'kyfr-fb-'))
execSync(`npx vite build --outDir ${out} --emptyOutDir`, { cwd: new URL('../..', import.meta.url).pathname, env: { ...process.env, VITE_FEEDBACK_WEBHOOK_URL: hook }, stdio: 'ignore' })
const { server, port } = await serve(out)
const base = `http://127.0.0.1:${port}/`

let bad = 0
const check = (name, ok, extra = '') => { console.log(ok ? '  ok  ' : ' FAIL ', name, ok ? '' : extra); if (!ok) bad++ }
const FAMILY = 'age=32&gender=male&income=2400000&spouse=1&kids=1&loans=home'

const b = await launch({ width: 1100, height: 900, mobile: false })
const fresh = async (hash) => { await b.goto(base); await b.eval('localStorage.clear()'); await b.goto('about:blank', 200); await b.goto(base + hash, 1500) }
const click = (text) => b.eval(`(()=>{const e=[...document.querySelectorAll('.fb button')].find(x=>x.innerText.trim()===${JSON.stringify(text)}); if(!e) return 'NOT FOUND'; e.click(); return 'ok'})()`)
const card = () => b.eval(`document.querySelector('.fb') ? document.querySelector('.fb').innerText.replace(/\\s+/g,' ') : ''`)
const typeInto = (text) => b.eval(`(()=>{const e=document.querySelector('#fb-comment'); const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; set.call(e, ${JSON.stringify(text)}); e.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'})()`)

console.log('the card')
await fresh(`#/term/done?${FAMILY}`)
let t = await card()
check('it asks "Was this helpful?" with two plain answers', /Was this helpful\?/.test(t) && /Yes, it helped/.test(t) && /Not really/.test(t), t)
check('no text box and no Send until a rating is chosen', !(await b.eval(`!!document.querySelector('#fb-comment')`)) && !/Send/.test(t), t)
const pos = JSON.parse(await b.eval(`JSON.stringify({fb: document.querySelector('.fb').getBoundingClientRect().top, report: document.querySelector('.report').getBoundingClientRect().top, inView: document.querySelector('.fb').getBoundingClientRect().top < innerHeight})`))
check('it sits above the report and is on screen without scrolling', pos.fb < pos.report && pos.inView, JSON.stringify(pos))

console.log('\nsending')
await click('Not really')
t = await card()
check('choosing "Not really" asks what was missing, marked optional', /What was missing or unclear\?/.test(t) && /Optional/i.test(t), t)
check('it says only the rating and words are sent, with no contact details', /Only your rating and what you write here are sent/.test(t) && /no name or contact details/.test(t) && /stay in your browser/.test(t), t)
await typeInto('Wanted to see ₹1 crore cover compared. <b>bold</b>')
await click('Send'); await b.wait(900)
check('the card thanks the person', /Thank you/.test(await card()), await card())
check('exactly one response reached the sheet', received.length === 1, JSON.stringify(received))
const r = received[0] || {}
check('it carries the rating, the words as plain text, the journey and a session id', r.helpful === 'no' && r.comment === 'Wanted to see ₹1 crore cover compared. <b>bold</b>' && r.journey === 'term' && r.device === 'computer' && r.surface === 'web' && typeof r.sessionId === 'string' && r.sessionId.length >= 8, JSON.stringify(r))
check('it carries nothing else: no age, income, family or loans', JSON.stringify(Object.keys(r).sort()) === JSON.stringify(['comment', 'device', 'helpful', 'journey', 'sessionId', 'surface']) && !/2400000|32|spouse|home/i.test(JSON.stringify(r).replace(r.sessionId, '')), JSON.stringify(r))

console.log('\nasked once')
await b.goto(base + `#/term/done?${FAMILY}`, 300); await b.eval('location.reload()'); await b.wait(1500)
t = await card()
check('coming back shows the thanks, not the question again', /Thank you/.test(t) && !/Was this helpful/.test(t), t)
check('and nothing more is sent', received.length === 1, String(received.length))

console.log('\nthe other journeys')
await b.eval('localStorage.removeItem("kyfr-insurance-agent.feedback")')
await b.goto(base + `#/done/term?${FAMILY}`, 300); await b.eval('location.reload()'); await b.wait(1500)
await click('Yes, it helped')
check('"Yes" asks what was most useful', /What was most useful\?/.test(await card()), await card())
await click('Send'); await b.wait(900)
check('with no words at all, it still sends, and names the full guide', received.length === 2 && received[1].helpful === 'yes' && received[1].comment === '' && received[1].journey === 'full' && received[1].sessionId === received[0].sessionId, JSON.stringify(received[1]))

console.log('\na failed send')
await fresh(`#/health/done?${FAMILY}`)
await click('Yes, it helped')
await typeInto('Useful, thanks')
failNext = 1
await click('Send'); await b.wait(900)
t = await card()
check('it says it could not send, and keeps what was written', /could not send that/.test(t) && (await b.eval(`document.querySelector('#fb-comment').value`)) === 'Useful, thanks', t)
check('the button now offers "Try again"', /Try again/.test(t), t)
const before = received.length
await click('Try again'); await b.wait(900)
check('trying again works, and the sheet gets exactly one more response', /Thank you/.test(await card()) && received.length === before + 1 && received[before].journey === 'health', JSON.stringify(received.slice(before)))

console.log('\nthree quick taps on Send')
await fresh(`#/term/done?${FAMILY}`)
await click('Yes, it helped'); await typeInto('Tapped three times')
const beforeTaps = received.length
await b.eval(`(()=>{const e=[...document.querySelectorAll('.fb button')].find(x=>x.innerText.trim()==='Send'); e.click(); e.click(); e.click()})()`)
await b.wait(1200)
check('three taps in the same instant send exactly one response', received.length === beforeTaps + 1, String(received.length - beforeTaps))

console.log('\nthe host app')
await fresh(`#/term/done?${FAMILY}`)
await b.eval(`window.__msgs=[]; window.ReactNativeWebView={postMessage:(m)=>window.__msgs.push(JSON.parse(m))}`)
await click('Yes, it helped'); await typeInto('Clear'); await click('Send'); await b.wait(900)
const msgs = JSON.parse(await b.eval('JSON.stringify(window.__msgs)')).filter((m) => m.type === 'feedback')
check('a host app is told about the feedback', msgs.length === 1 && msgs[0].helpful === 'yes' && msgs[0].comment === 'Clear' && msgs[0].journey === 'term', JSON.stringify(msgs))
check('and the sheet marks it as coming from the app', received.at(-1).surface === 'app', JSON.stringify(received.at(-1)))

console.log('\nthe PDF and the phone')
await fresh(`#/term/done?${FAMILY}`)
const pdf = join(out, 'r.pdf'); await b.pdf(pdf)
const text = execSync(`pdftotext -layout ${pdf} -`).toString()
check('the saved PDF does not contain the feedback card', !/Was this helpful|Yes, it helped|Not really/.test(text), text.slice(0, 200))
await b.setViewport(390, 844, true)
await fresh(`#/term/done?${FAMILY}`)
await click('Not really')
await typeInto('x'.repeat(520))
const phone = JSON.parse(await b.eval(`JSON.stringify({over: document.documentElement.scrollWidth - innerWidth, max: document.querySelector('#fb-comment').maxLength, box: document.querySelector('#fb-comment').getBoundingClientRect().right <= innerWidth, device: null})`))
check('on a phone nothing overflows sideways, and the box is limited to 500 characters', phone.over <= 1 && phone.box && phone.max === 500, JSON.stringify(phone))
await click('Send'); await b.wait(900)
check('a phone response is marked as a phone, and even pasted text is cut to 500 on its way', received.at(-1).device === 'phone' && received.at(-1).comment.length === 500, JSON.stringify(received.at(-1)).slice(0, 160))

const errs = b.consoleMsgs.filter((m) => (m.type === 'error' || m.type === 'exception') && !/Failed to load resource/.test(JSON.stringify(m)))
check('no console errors', errs.length === 0, JSON.stringify(errs))
await b.close(); server.close(); mock.close()
console.log(bad ? `\n${bad} FAILED` : '\nall feedback checks passed')
process.exit(bad ? 1 : 0)
