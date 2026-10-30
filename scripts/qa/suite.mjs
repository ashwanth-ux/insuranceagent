import { serve, launch } from './cdp.mjs'
const OUT = '/private/tmp/claude-501/-Users-macbook-Downloads/8c3efb38-f63c-4523-8484-a05cb88fc019/scratchpad/'
const { server, port } = await serve(new URL('../../dist', import.meta.url).pathname)
const base = `http://127.0.0.1:${port}/`
const problems = []
const note = (m) => { problems.push(m); console.log('  ✗', m) }
const ok = (m) => console.log('  ✓', m)

const PAGE_CHECK = `(()=>{
  const t=document.body.innerText.replace(/\\(Infinity benefit\\)/g,''); const bad=t.match(/.{0,25}(NaN|undefined|Infinity|\\[object).{0,25}/);
  const de=document.documentElement; const overflow=de.scrollWidth>de.clientWidth+1;
  const wide=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>de.clientWidth+1&&r.width>0&&!e.closest('.tbl-wrap,.seg,.slider,.sr')&&getComputedStyle(e).position!=='fixed'}).slice(0,3).map(e=>e.tagName+'.'+e.className);
  const unnamed=[...document.querySelectorAll('button,a[href],input,select,[role=button]')].filter(e=>{const n=(e.getAttribute('aria-label')||e.textContent||'').trim()||(e.id&&document.querySelector('label[for="'+e.id+'"]')?.textContent.trim())||e.getAttribute('title')||(e.closest('label')?.textContent.trim()); return !n}).slice(0,3).map(e=>e.outerHTML.slice(0,80));
  const ids=[...document.querySelectorAll('[id]')].map(e=>e.id); const dup=ids.filter((x,i)=>ids.indexOf(x)!==i);
  return JSON.stringify({bad:bad?bad[0]:null,overflow,wide,unnamed,dup:[...new Set(dup)],h1:document.querySelectorAll('h1').length,len:t.length});
})()`

async function check(b, label) {
  await b.wait(350)
  const r = JSON.parse(await b.eval(PAGE_CHECK))
  const errs = b.consoleMsgs.filter((m) => m.type === 'error' || m.type === 'exception')
  b.consoleMsgs.length = 0
  if (r.bad) note(`${label}: bad text "${r.bad}"`)
  if (r.overflow) note(`${label}: horizontal overflow ${JSON.stringify(r.wide)}`)
  if (r.unnamed.length) note(`${label}: unnamed controls ${JSON.stringify(r.unnamed)}`)
  if (r.dup.length) note(`${label}: duplicate ids ${r.dup}`)
  if (r.h1 !== 1) note(`${label}: ${r.h1} h1 elements`)
  if (r.len < 80) note(`${label}: page almost empty (${r.len} chars)`)
  if (errs.length) note(`${label}: console errors ${JSON.stringify(errs.slice(0, 2))}`)
  return r
}

const ROUTES = ['', 'need', 'amount', 'amount/term', 'amount/health', 'addons/term', 'addons/health', 'shortlist', 'shortlist/term', 'shortlist/health', 'term', 'health', 'health/addons', 'term/insurers', 'health?age=34&spouse=1&kids=2&parents=2&embed=0', 'faq', 'faq?open=h_super', 'faq?q=room%20rent', 'faq?q=gibberish%20xyzzy', 'ask?q=zero%20dep']

for (const [name, vp] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844, mobile: true }]]) {
  console.log(`\n=== ${name} routes`)
  const b = await launch(vp)
  await b.goto(base)
  for (const r of ROUTES) {
    await b.goto(base + '#/' + r, 450)
    await check(b, `${name} #/${r}`)
    // reveal results where a reveal button exists
    const clicked = await b.eval(`(()=>{const e=[...document.querySelectorAll('button')].find(x=>/^(Show my answer|Show what I need)/.test(x.textContent.trim())); if(e){e.click(); return true} return false})()`)
    if (clicked) { await b.wait(700); await check(b, `${name} #/${r} (revealed)`) }
    if (/^(amount|term|health)(\/)?$/.test(r) || /^amount\//.test(r)) { await b.clickText('Edit'); await b.wait(500); await check(b, `${name} #/${r} (adjust open)`) }
  }
  ok(`${ROUTES.length} routes checked at ${name}`)
  await b.close()
}

console.log('\n=== hostile input into every money field and stepper (desktop)')
{
  const b = await launch({ width: 1280, height: 900 })
  const HOSTILE = ['0', '-5', '1e12', 'abc', '99999999999999999999', '1 crore', '₹ 5,00,000', '', '   ', '1.5.5', '🔥', '2 lpa', '0.0001', '5000000000000', '-0']
  for (const route of ['need', 'amount/term', 'amount/health']) {
    await b.goto(base + '#/' + route, 500)
    await b.eval(`(()=>{const e=[...document.querySelectorAll('button')].find(x=>/^(Show my answer|Show what I need)/.test(x.textContent.trim())); if(e) e.click()})()`)
    if (route.startsWith('amount/')) { await b.clickText('Edit'); await b.wait(500) }
    if (route === 'need') { await b.clickText('Next'); await b.wait(150); await b.clickText('Next'); await b.wait(300) }
    // open conditional blocks so more inputs exist
    if (route === 'amount/term') { await b.clickText('Spouse or partner'); await b.clickText('Children'); await b.clickText('I have loans'); await b.clickText('I have one') }
    if (route === 'amount/health') { await b.clickText('Children'); await b.clickText('Parents') }
    await b.wait(300)
    const n = await b.eval(`document.querySelectorAll('input.input--money').length`)
    for (let i = 0; i < n; i++) {
      for (const h of HOSTILE) {
        const res = await b.eval(`(()=>{
          const inputs=[...document.querySelectorAll('input.input--money')]; const e=inputs[${i}]; if(!e) return 'gone';
          const root=e.closest('.stack'); const ends=[...(root.querySelectorAll('.slider__ends span'))].map(s=>s.textContent);
          e.focus(); const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(e,${JSON.stringify(h)}); e.dispatchEvent(new Event('input',{bubbles:true})); e.blur();
          return JSON.stringify({ends});
        })()`)
        if (res === 'gone') continue
        await b.wait(90)
        const r = JSON.parse(res)
        r.shown = await b.eval(`document.querySelectorAll('input.input--money')[${i}]?.value ?? ''`)
        const text = await b.eval('document.body.innerText')
        if (/NaN|undefined|Infinity/.test(text)) note(`${route} money#${i} typed ${JSON.stringify(h)} → page shows NaN/undefined`)
        if (/NaN|undefined|Infinity/.test(r.shown)) note(`${route} money#${i} typed ${JSON.stringify(h)} → field shows ${r.shown}`)
        if (r.ends.length === 2) {
          const num = (s) => { const m = s.replace(/[₹,\s]/g, '').match(/^([\d.]+)(lakh|crore)?$/); if (!m) return NaN; return parseFloat(m[1]) * (m[2] === 'crore' ? 1e7 : m[2] === 'lakh' ? 1e5 : 1) }
          const lo = num(r.ends[0]), hi = num(r.ends[1]); const shown = parseFloat(r.shown.replace(/[^\d.]/g, ''))
          if (Number.isFinite(lo) && Number.isFinite(hi) && Number.isFinite(shown) && (shown < lo * 0.995 || shown > hi * 1.005)) note(`${route} money#${i} typed ${JSON.stringify(h)} → shows ${r.shown}, outside ${r.ends.join('–')}`)
        }
      }
    }
    const sn = await b.eval(`document.querySelectorAll('.stepper__v').length`)
    for (let i = 0; i < sn; i++) for (const h of ['0', '-3', '999', 'abc', '1e9', '', '🔥', '17.9', '  42  ']) {
      await b.eval(`(()=>{const e=document.querySelectorAll('.stepper__v')[${i}]; if(!e) return ''; e.focus(); const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(e,${JSON.stringify(h)}); e.dispatchEvent(new Event('input',{bubbles:true})); e.blur(); return ''})()`)
      await b.wait(90)
      const shown = await b.eval(`document.querySelectorAll('.stepper__v')[${i}]?.value ?? ''`)
      if (!/^\d{1,3}$/.test(shown)) note(`${route} stepper#${i} typed ${JSON.stringify(h)} → "${shown}"`)
    }
    const errs = b.consoleMsgs.filter((m) => m.type === 'error' || m.type === 'exception'); b.consoleMsgs.length = 0
    if (errs.length) note(`${route}: console errors during hostile input ${JSON.stringify(errs.slice(0, 2))}`)
    ok(`${route}: ${n} money fields × ${HOSTILE.length} hostile values, ${sn} steppers`)
  }
  await b.close()
}

console.log('\n=== tampered storage and junk URLs')
{
  const b = await launch({ width: 1280, height: 900 })
  const JUNK = ['{', 'null', '[]', '"str"', '{"age":"abc","income":-1,"dependents":"x","owns":{"a":1},"revealed":{"need":"yes"}}', '{"age":1e999}', '{"age":999,"income":1e99,"kids":-4,"city":"mars"}', 'x'.repeat(100000), '{"revealed":{"amount.term":true,"need":true,"amount.health":true},"dependents":["spouse","children","parents"],"owns":["homeLoan","car"],"loans":1e15}']
  for (const j of JUNK) {
    await b.goto(base, 300)
    await b.eval(`localStorage.setItem('kyfr-insurance-agent.v1', ${JSON.stringify(j)})`)
    for (const r of ['need', 'amount/term', 'amount/health', 'addons/term', 'shortlist/term', 'faq?q=term']) {
      await b.goto(base + '#/' + r); await b.eval('location.reload()'); await b.wait(500)
      await check(b, `storage ${JSON.stringify(j.slice(0, 30))} #/${r}`)
    }
  }
  const URLS = ['#/amount/xyz', '#/faq?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E', '#/faq?open=%3Cb%3E', '#/shortlist/../..', '#/%%%', '#/faq?q=' + 'a'.repeat(5000), '#/faq?q=%00%01%02', '#/' + 'x/'.repeat(200), '#', '#/?', '#/faq?q=', '#/addons/%E0%A4%A']
  for (const u of URLS) { await b.goto(base + u, 500); await check(b, `url ${u.slice(0, 40)}`) }
  const xss = await b.eval('window.__xss === undefined')
  if (!xss) note('XSS payload executed')
  ok('storage and URL junk handled')
  await b.close()
}

console.log(`\n${problems.length === 0 ? 'ALL BROWSER CHECKS PASSED' : problems.length + ' PROBLEMS'}`)
server.close(); process.exit(problems.length ? 1 : 0)
