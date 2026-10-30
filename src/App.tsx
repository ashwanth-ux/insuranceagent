import { useEffect, useRef, useState } from 'react'
import { emit } from './bridge'
import { embedded } from './embed'
import { FlowProvider, PRODUCT_TITLE, scopedFlow } from './flow'
import { prefillFrom } from './prefill'
import { useRoute } from './router'
import { ProfileProvider, useProfile, type Product } from './state/profile'
import Landing from './pages/Landing'
import Need from './pages/Need'
import Amount from './pages/Amount'
import Addons from './pages/Addons'
import Shortlist from './pages/Shortlist'
import Faq from './pages/Faq'
import Done from './pages/Done'

const TITLES: Record<string, string> = {
  '': 'Kyfr Insurance Guide',
  need: 'What you need · Kyfr Insurance Guide',
  amount: 'How much cover · Kyfr Insurance Guide',
  addons: 'Add-ons · Kyfr Insurance Guide',
  shortlist: 'Best insurers · Kyfr Insurance Guide',
  done: 'All set · Kyfr Insurance Guide',
  faq: 'FAQ · Kyfr Insurance Guide',
}
const PRODUCTS: readonly string[] = ['term', 'health']
const isProduct = (s: string | undefined): s is Product => !!s && PRODUCTS.includes(s)

function Shell() {
  const { route, go } = useRoute()
  const { set } = useProfile()
  const [scrolled, setScrolled] = useState(false)
  const main = useRef<HTMLElement>(null)
  const applied = useRef('')
  const first = route.path[0] ?? ''
  const isEmbed = embedded()
  const product = isProduct(first) ? first : null

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  // A host app can hand over what it already knows. Applied once per distinct set of values, so later edits are never overwritten.
  useEffect(() => {
    let search: URLSearchParams
    try { search = new URLSearchParams(location.search) } catch { search = new URLSearchParams() }
    const patch = prefillFrom(route.q, search)
    if (!patch) return
    const key = JSON.stringify(patch)
    if (applied.current === key) return
    applied.current = key
    set(patch)
  }, [route, set])

  useEffect(() => {
    document.documentElement.dataset.embed = isEmbed ? 'true' : 'false'
  }, [isEmbed])

  useEffect(() => {
    document.title = first === 'done' || (product && route.path[1] === 'done') ? TITLES.done : product ? `${PRODUCT_TITLE[product][0].toUpperCase()}${PRODUCT_TITLE[product].slice(1)} · Kyfr Insurance Guide` : TITLES[first === 'ask' ? 'faq' : first] ?? TITLES['']
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    main.current?.focus({ preventScroll: true })
    emit({ type: 'step', route: route.path.join('/'), product })
  }, [first, route.path[1], product])

  const current = (k: string) => (first === k ? ({ 'aria-current': 'page' } as const) : {})
  const step = route.path[1]

  return (
    <>
      {!isEmbed && <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); main.current?.focus() }}>Skip to content</a>}
      {!isEmbed && (
        <header className={`top${scrolled ? ' is-scrolled' : ''}`}>
          <div className="shell shell--wide top__in">
            <a className="brand" href="#/" aria-label="Kyfr Insurance Guide, home">
              <img className="brand__mark" src="/kyfr-logo.svg" alt="" width="28" height="28" />
              <span>KYFR<span className="brand__slash">/</span></span>
              <span className="brand__sub">Insurance Guide</span>
            </a>
            <nav className="nav" aria-label="Main">
              <a className="nav__opt" href="#/need" {...current('need')}>Need</a>
              <a className="nav__opt" href="#/amount" {...current('amount')}>Amount</a>
              <a className="nav__opt" href="#/addons" {...current('addons')}>Add-ons</a>
              <a className="nav__opt" href="#/shortlist" {...current('shortlist')}>Insurers</a>
              <a href="#/faq" {...current('faq')}>FAQ</a>
            </nav>
          </div>
        </header>
      )}
      <main id="main" ref={main} tabIndex={-1} style={{ outline: 'none' }}>
        {first === '' && <Landing />}
        {first === 'need' && <Need go={go} />}
        {first === 'amount' && <Amount go={go} product={route.path[1]} />}
        {first === 'addons' && <Addons go={go} product={route.path[1]} />}
        {first === 'shortlist' && <Shortlist go={go} product={route.path[1]} />}
        {first === 'done' && <Done go={go} product={route.path[1]} />}
        {product && (
          <FlowProvider value={scopedFlow(product)}>
            {step === 'addons' ? <Addons go={go} product={product} /> : step === 'insurers' ? <Shortlist go={go} product={product} /> : step === 'done' ? <Done go={go} product={product} /> : <Amount go={go} product={product} />}
          </FlowProvider>
        )}
        {(first === 'faq' || first === 'ask') && <Faq go={go} open={route.q.get('open') ?? ''} q={route.q.get('q') ?? ''} />}
        {!['', 'need', 'amount', 'addons', 'shortlist', 'done', 'faq', 'ask', ...PRODUCTS].includes(first) && <Landing />}
      </main>
      {!isEmbed && (
        <footer className="foot">
          <div className="shell shell--wide stack stack--sm">
            <p>General education, not advice. Premiums are indicative ranges, not offers.</p>
            <details className="foot__more">
              <summary>About these numbers</summary>
              <p>Cover amounts come from the formulas shown under “How we got this”. Premiums are indicative ranges calibrated to published quotes.</p>
              <p>Insurer data: IRDAI Handbook on Indian Insurance Statistics 2024-25, insurers’ public disclosures as compiled by Ditto Data Lab (FY2024-26), and the General Insurance Council (FY2025-26). Plan details are compiled from public sources and change. Read the policy wording before you buy.</p>
            </details>
          </div>
        </footer>
      )}
    </>
  )
}

export default function App() {
  return (
    <ProfileProvider>
      <Shell />
    </ProfileProvider>
  )
}
