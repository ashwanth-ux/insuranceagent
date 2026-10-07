// Screenshots of the key screens at phone, tablet and desktop widths. First screen (what a person sees without scrolling) and the full page.
import { serve, launch } from './cdp.mjs'
const OUT = '/private/tmp/claude-501/-Users-macbook-Downloads/8c3efb38-f63c-4523-8484-a05cb88fc019/scratchpad/s/'
import { mkdirSync } from 'node:fs'
mkdirSync(OUT, { recursive: true })
const { server, port } = await serve(new URL('../../dist', import.meta.url).pathname)
const base = `http://127.0.0.1:${port}/`
const family = { age: 32, gender: 'male', dependents: ['spouse', 'children', 'parents'], spouseEarns: false, kids: 2, youngestChildAge: 4, parents: 2, parentAge: 62, income: 2400000, owns: ['homeLoan', 'car'], vehicleValue: 1200000, vehicleAge: '1to2', ncb: 35, floodProne: true, touched: { age: true } }
const VIEWS = { m: [390, 844, true], t: [820, 1180, false], d: [1440, 900, false] }
const want = process.argv.filter((a) => /^[mtd]$/.test(a))
const routes = process.argv.filter((a) => a.startsWith('#/')).map((a) => a.slice(2))
for (const tag of want.length ? want : Object.keys(VIEWS)) {
  const [w, h, m] = VIEWS[tag]
  const b = await launch({ width: w, height: h, mobile: m })
  await b.goto(base)
  await b.eval(`localStorage.setItem('kyfr-insurance-agent.v1', ${JSON.stringify(JSON.stringify(family))})`)
  for (const r of routes.length ? routes : ['', 'need', 'health', 'health/addons', 'term', 'term/addons', 'motor', 'motor/addons', 'health/insurers', 'faq']) {
    await b.goto(base + '#/' + r); await b.eval('location.reload()'); await b.wait(900)
    const name = `${tag}-${r.replace(/[/?=&]/g, '-') || 'home'}`
    await b.shot(OUT + name + '.png')
    await b.shot(OUT + name + '-full.png', { full: true })
    const sh = await b.eval('document.documentElement.scrollHeight')
    console.log(name, 'height', sh, 'x', Math.round(sh / h * 10) / 10, 'screens')
  }
  await b.close()
}
server.close(); process.exit(0)
