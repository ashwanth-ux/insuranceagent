import { serve, launch } from './cdp.mjs'
const OUT = '/private/tmp/claude-501/-Users-macbook-Downloads/8c3efb38-f63c-4523-8484-a05cb88fc019/scratchpad/'
const mobile = process.argv.includes('--mobile')
const { server, port } = await serve(new URL('../../dist', import.meta.url).pathname)
const b = await launch(mobile ? { width: 390, height: 844, mobile: true } : { width: 1280, height: 900 })
const base = `http://127.0.0.1:${port}/`
const tag = mobile ? 'm' : 'd'
const log = (...a) => console.log(...a)
await b.goto(base + '#/need')
await b.clickText('Spouse or partner'); await b.clickText('Children'); await b.clickText('Home loan'); await b.clickText('Car')
await b.clickText('Health plan I pay for'.slice(0, 0) || 'Health cover from my employer')
await b.type('#main input.input--money', '2400000')
await b.wait(200)
await b.clickText('Show what I need'); await b.wait(900)
await b.shot(OUT + `qa-need-${tag}.png`, { full: true })
log('NEED headline:', await b.eval('document.querySelector("section[aria-label=\\"Your answer\\"] h2")?.textContent'))

await b.goto(base + '#/amount/term'); await b.wait(300)
await b.clickText('Edit details'); await b.wait(500)
await b.shot(OUT + `qa-term-${tag}.png`, { full: true })
log('TERM big:', await b.eval('document.querySelector(".result__big")?.textContent'))

await b.goto(base + '#/addons/term'); await b.wait(500)
await b.shot(OUT + `qa-addons-term-${tag}.png`, { full: true })
await b.goto(base + '#/shortlist/term'); await b.wait(500)
await b.shot(OUT + `qa-shortlist-term-${tag}.png`, { full: true })
log('errors:', JSON.stringify(b.consoleMsgs.filter((m) => m.type === 'error' || m.type === 'exception')))
await b.close(); server.close(); process.exit(0)
