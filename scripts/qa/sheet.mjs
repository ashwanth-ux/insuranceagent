import { serve, launch } from './cdp.mjs'
const OUT = '/private/tmp/claude-501/-Users-macbook-Downloads/8c3efb38-f63c-4523-8484-a05cb88fc019/scratchpad/s/'
const { server, port } = await serve(new URL('../../dist', import.meta.url).pathname)
const base = `http://127.0.0.1:${port}/`
const family = { age: 32, dependents: ['spouse', 'children', 'parents'], kids: 2, youngestChildAge: 4, parents: 2, parentAge: 62, income: 2400000, owns: ['homeLoan', 'car'], touched: { age: true } }
for (const [tag, w, h, m] of [['m', 390, 844, true], ['d', 1440, 900, false]]) {
  const b = await launch({ width: w, height: h, mobile: m })
  await b.goto(base)
  await b.eval(`localStorage.setItem('kyfr-insurance-agent.v1', ${JSON.stringify(JSON.stringify(family))})`)
  await b.goto(base + '#/health'); await b.eval('location.reload()'); await b.wait(800)
  await b.clickText('Edit'); await b.wait(600)
  await b.shot(OUT + `${tag}-sheet-health.png`)
  await b.eval(`document.querySelector('.sheet__done').click()`); await b.wait(700)
  await b.shot(OUT + `${tag}-after-done.png`)
  await b.goto(base + '#/need'); await b.eval('localStorage.setItem("kyfr-insurance-agent.v1", "{}"); location.reload()'); await b.wait(800)
  await b.shot(OUT + `${tag}-need-q1.png`)
  await b.goto(base + '#/'); await b.wait(600)
  await b.shot(OUT + `${tag}-landing.png`)
  await b.close()
}
server.close(); process.exit(0)
