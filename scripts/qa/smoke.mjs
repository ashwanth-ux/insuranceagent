import { serve, launch } from './cdp.mjs'
const { server, port } = await serve(new URL('../../dist', import.meta.url).pathname)
const b = await launch({ width: 1280, height: 900 })
const out = '/private/tmp/claude-501/-Users-macbook-Downloads/8c3efb38-f63c-4523-8484-a05cb88fc019/scratchpad/'
await b.goto(`http://127.0.0.1:${port}/`)
await b.shot(out + 'qa-landing-desktop.png')
console.log('title:', await b.eval('document.title'), '| h1:', await b.eval('document.querySelector("h1")?.textContent'))
console.log('errors:', JSON.stringify(b.consoleMsgs.filter(m => m.type === 'error' || m.type === 'exception')))
await b.close(); server.close()
