import { serve, launch } from './cdp.mjs'
const { server, port } = await serve(new URL('../../dist', import.meta.url).pathname)
const base = `http://127.0.0.1:${port}/`
const family = { age: 32, dependents: ['spouse', 'children', 'parents'], kids: 2, youngestChildAge: 4, parents: 2, parentAge: 62, income: 2400000, owns: ['homeLoan', 'car'], touched: { age: true } }
const b = await launch({ width: 1440, height: 900 })
await b.goto(base)
await b.eval(`localStorage.setItem('kyfr-insurance-agent.v1', ${JSON.stringify(JSON.stringify(family))})`)
let bad = 0
for (const r of ['term/insurers', 'health/insurers', 'motor/insurers']) {
  await b.goto(base + '#/' + r); await b.eval('location.reload()'); await b.wait(900)
  const res = await b.eval(`(()=>{const h=[...document.querySelectorAll('h2')].find(x=>/clear the bar/.test(x.textContent)); const n=Number(h.textContent.match(/^(\\d+)/)[1]); const cards=[...document.querySelectorAll('.pcard')]; const titles=cards.map(c=>c.querySelector('.eyebrow').textContent+' | '+c.querySelector('.title').textContent); return JSON.stringify({n, cards:cards.length, titles})})()`)
  const o = JSON.parse(res); console.log(r, o.n, 'insurers,', o.cards, 'cards'); if (o.cards < o.n) bad++
  console.log('  ', o.titles.join('\n   '))
}
await b.close(); server.close(); console.log(bad ? 'MISMATCH' : 'every insurer has a card'); process.exit(bad ? 1 : 0)
