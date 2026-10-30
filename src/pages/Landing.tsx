import { Arrow } from '../ui/primitives'

const PRODUCTS = [
  { to: 'health', t: 'Health', s: 'Hospital bills for you, your family and your parents.' },
  { to: 'term', t: 'Term life', s: 'Cover for your family if you are not around.' },
] as const

export default function Landing() {
  return (
    <div className="shell shell--wide page">
      <section className="hero">
        <div className="stack stack--lg">
          <p className="eyebrow">Term · Health</p>
          <h1 className="display hero__title">Know exactly what insurance you need.</h1>
          <p className="lead">Plain answers. Every number shows its working.</p>
          <div className="row" style={{ gap: 12 }}>
            <a className="btn btn--brand" href="#/need">Start <Arrow /></a>
            <a className="btn" href="#/faq">FAQ</a>
          </div>
          <p className="caption">Built on IRDAI data. No sign-up. Your answers stay in your browser.</p>
        </div>
        <div className="stack" role="list" aria-label="Go straight to one">
          <p className="eyebrow">Or go straight to one</p>
          {PRODUCTS.map((p) => (
            <a key={p.to} role="listitem" className="card card--link path" href={`#/${p.to}`}>
              <span>
                <span className="path__t" style={{ display: 'block' }}>{p.t}</span>
                <span className="path__s" style={{ display: 'block' }}>{p.s}</span>
              </span>
              <span className="path__go" aria-hidden="true"><Arrow /></span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
