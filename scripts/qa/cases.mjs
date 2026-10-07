import { serve, launch } from './cdp.mjs'
import { mkdirSync } from 'node:fs'
const OUT = '/private/tmp/claude-501/-Users-macbook-Downloads/8c3efb38-f63c-4523-8484-a05cb88fc019/scratchpad/c/'
mkdirSync(OUT, { recursive: true })
const { server, port } = await serve(new URL('../../dist', import.meta.url).pathname)
const base = `http://127.0.0.1:${port}/`
const single = { age: 30, income: 1800000, dependents: [], monthlySpend: 40000, touched: { age: true, dependents: true } }
const goal = { ...single, goals: [{ label: 'Buy a house', todayCost: 5000000, yearsAway: 5 }] }
const family = { age: 32, dependents: ['spouse', 'children', 'parents'], kids: 2, youngestChildAge: 4, parents: 2, parentAge: 62, income: 2400000, owns: ['homeLoan', 'car'], touched: { age: true } }
const CASES = [['single', single, ['term', 'term/addons', 'term/insurers']], ['goal', goal, ['term', 'term/insurers']], ['family', family, ['health/insurers', 'term/insurers', 'motor/insurers']]]
for (const [tag, w, h, m] of [['m', 390, 844, true], ['d', 1440, 900, false]]) {
  const b = await launch({ width: w, height: h, mobile: m })
  await b.goto(base)
  for (const [name, prof, routes] of CASES) {
    await b.eval(`localStorage.setItem('kyfr-insurance-agent.v1', ${JSON.stringify(JSON.stringify(prof))})`)
    for (const r of routes) {
      await b.goto(base + '#/' + r); await b.eval('location.reload()'); await b.wait(900)
      await b.shot(OUT + `${tag}-${name}-${r.replace('/', '-')}.png`)
    }
  }
  // goals editor
  await b.eval(`localStorage.setItem('kyfr-insurance-agent.v1', ${JSON.stringify(JSON.stringify(goal))})`)
  await b.goto(base + '#/term'); await b.eval('location.reload()'); await b.wait(800)
  await b.clickText('Edit'); await b.wait(500)
  await b.eval(`document.querySelectorAll('.sheet__body .q').forEach(q=>{ if(/big goals/i.test(q.textContent)) q.scrollIntoView() })`); await b.wait(300)
  await b.shot(OUT + `${tag}-goals-editor.png`)
  await b.close()
}
server.close(); process.exit(0)
