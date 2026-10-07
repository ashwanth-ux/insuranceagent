# Kyfr Insurance Guide

A standalone guide to term, health and motor insurance in India. It works out what you need, how much cover, which add-ons are worth it, and which insurers clear the bar. Every number shows its working.

Live: https://kyfr-insurance-guide.vercel.app

## Run it

```bash
npm install
npm run dev      # local dev server
npm test         # engine and unit tests (vitest)
npm run build    # type-check and build to dist/
```

Browser checks (headless Chrome, no extra dependencies): `node scripts/qa/suite.mjs` after a build. `scripts/qa/shots2.mjs` takes screenshots at phone, tablet and desktop widths.

## How it is built

- Vite, React and TypeScript. A static single-page app with hash routes and no backend. Answers stay in the browser.
- `src/engine/` holds the pure calculations: term need, health base plans and super top-up, motor insured value, add-on selection, insurer funnel. `src/data/` holds the published data they use.
- Each product is a flow of its own (`#/term`, `#/health`, `#/motor`): cover, then add-ons, then insurers.
- Premiums are indicative ranges, not quotes.

To embed it in another app (deep links, prefill, events), see [INTEGRATION.md](INTEGRATION.md).
