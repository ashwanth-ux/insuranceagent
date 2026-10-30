import { serve, launch } from './cdp.mjs'
const OUT = '/private/tmp/claude-501/-Users-macbook-Downloads/8c3efb38-f63c-4523-8484-a05cb88fc019/scratchpad/'
const { server, port } = await serve(new URL('../../dist', import.meta.url).pathname)
const base = `http://127.0.0.1:${port}/`
const arjun = { age: 32, gender: 'male', dependents: ['spouse', 'children'], spouseEarns: false, kids: 1, youngestChildAge: 2, income: 2400000, monthlySpend: 75000, owns: ['homeLoan'], loans: 4500000, freeSavings: 600000, covered: ['employerHealth'], employerCover: 500000, vehicleValue: 1200000, vehicleAge: '1to2', ncb: 35, onLoan: true, couldReplace: false, floodProne: true,
  revealed: { need: true, 'amount.term': true, 'amount.health': true } }
const [w, h, mobile, tag] = process.argv.includes('--desktop') ? [1280, 900, false, 'd'] : [390, 844, true, 'm']
const b = await launch({ width: w, height: h, mobile })
await b.goto(base)
await b.eval(`localStorage.setItem('kyfr-insurance-agent.v1', ${JSON.stringify(JSON.stringify(arjun))})`)
const pages = process.argv.filter((a) => a.startsWith('#/')).map((a) => a.slice(2))
for (const r of pages.length ? pages : ['', 'need', 'amount/term', 'amount/health', 'addons/term', 'shortlist/term', 'ask?q=I%27m%2032%2C%20earn%2024%20lakh%2C%20wife%20at%20home%2C%20one%20child%20aged%202%2C%2045%20lakh%20home%20loan.%20How%20much%20term%20cover%20do%20I%20need%3F']) {
  await b.goto(base + '#/' + r); await b.eval('location.reload()'); await b.wait(900)
  await b.shot(OUT + `shot-${tag}-${r.split('?')[0].replace('/', '-') || 'home'}.png`, { full: true })
}
await b.close(); server.close(); process.exit(0)
