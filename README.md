# Kyfr Insurance Guide

A standalone guide to term and health insurance in India. It works out what you need, how much cover, which add-ons are worth it, and which insurers clear the bar. Every number shows its working.

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
- `src/engine/` holds the pure calculations: term need, health base plans and super top-up, add-on selection, insurer funnel. `src/data/` holds the published data they use.
- Each product is a flow of its own (`#/term`, `#/health`): cover, then add-ons, then insurers.
- Premiums are indicative ranges, not quotes.

To embed it in another app (deep links, prefill, events), see [INTEGRATION.md](INTEGRATION.md).

## Feedback

The last page asks "Was this helpful?" and takes a few optional words. Each response is one row in a Google Sheet.

1. Create a new Google Sheet (separate from any sheet that holds contact details).
2. Extensions > Apps Script. Paste `scripts/feedback-sheet/Code.gs`. Pick `setup` in the function menu and press Run. It creates the `Feedback` and `Summary` tabs.
3. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Copy the web app URL.
4. In Vercel, add the environment variable `VITE_FEEDBACK_WEBHOOK_URL` with that URL (Production), and redeploy. For local testing, put it in `.env.local`.

Only the rating, the words, the journey (term, health or full guide), the device kind and a random id are sent. The same person sending again on the same journey updates their row. Without the variable the form still shows but nothing is saved.

`node scripts/qa/feedback.mjs` builds a copy wired to a local stand-in for the sheet and uses the form in real Chrome.

