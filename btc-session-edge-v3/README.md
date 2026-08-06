# BTC Session Edge v3

Single-file artifact. **Open `index.html` in a browser. That's it.** No server, no
install, no build step — double-clicking it off disk works, because the loader
inlines every resource (dataset, React, fonts) as a blob URL before the app boots.

Add `?selftest=1` to the URL to run the built-in assertions; results print to the
browser console. Verified 14/14 under `file://`.

## Hosted copy

The Vercel project builds from `web/`, so nothing at the repo root is deployed.
`web/public/btc-session-edge-v3.html` is a copy of the bundle placed inside that
build root, which Next.js serves as a static file:

```
https://ai-thesis-v2.vercel.app/btc-session-edge-v3.html
```

That URL is behind Vercel SSO (`all_except_custom_domains`), so it is reachable
by the account owner and nobody else.

`index.html` stays the canonical artifact. After any change run
`node tools/bundle.mjs deploy` to refresh the served copy — `verify` fails with
"web/public copy is stale" if you forget, so the two cannot silently drift.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The shipping bundle. Self-extracting: loader + gzipped assets + the app. |
| `src/app.html` | **Edit this.** The real `<x-dc>` document, extracted from the bundle. |
| `tools/bundle.mjs` | `extract` / `inject` / `verify` between the two. |
| `tools/selftest.mjs` | Runs the in-artifact harness headlessly + layout assertions. |
| `tools/behaviour.mjs` | Node tests for the behaviour the in-artifact harness can't reach. |
| `reference/btcsessionedge2-v2.jsx` | The v2 predecessor. Provenance only — **not** the source of this build. |

### Why the split

All application logic lives in the bundle's `__bundler/template` block, stored as a
JSON string. Patching that directly means editing inside JSON escaping, which is
unreviewable in a diff. So: extract to `src/app.html`, edit there, inject back.

`inject` is the exact inverse of `extract` — `node tools/bundle.mjs verify` asserts
the round trip is byte-identical, and it is.

## Workflow

```sh
node tools/bundle.mjs extract     # index.html -> src/app.html
$EDITOR src/app.html
node tools/bundle.mjs inject      # src/app.html -> index.html
node tools/bundle.mjs deploy      # index.html -> web/public/ (the hosted copy)
node tools/selftest.mjs           # 14 model assertions + layout, in a real browser
node tools/behaviour.mjs          # 59 behavioural assertions, in Node
```

Both runners exit non-zero on failure.

## Testing

The artifact has no test runner, and adding one (Vitest, a bundler, a module split)
would be a larger change than every fix it exists to verify. Instead there are two
harnesses:

**`selfTest()` — ships inside the artifact.** Load `index.html?selftest=1` and it
prints a `console.table` in the browser console. Every row maps to a spec clause or
a fixed defect: `driftNudge` shape, suffix resolution, the `REMVAR`/`SHAPE` dataset
invariants, three pinned `model()` outputs, the σ_cur estimator, and the `refitB`
n≥150 gate. A red row means the model is no longer computing what the build plan
says it does. `tools/selftest.mjs` runs the same thing headlessly.

**`tools/behaviour.mjs` — Node.** The build plan verifies the rest by hand ("wait
for the quarter-hour to roll", "log 150 rows"). That is not repeatable, so this
loads the real `Component` class out of the `x-dc` block, stubs `DCLogic` and
`localStorage`, and drives it directly — same code, no browser, deterministic
clock. It covers the session roll, px75 carry-forward, the B refit and its v2-row
filter, the maker-fee prop, FIFO resolve ordering, the flip dot, saves-vs-costs,
resolve back-fill, CSV shape, and reload persistence.

## Constraints this build holds to

- Desktop three-column layout is accepted as built. No `@media` queries, `min-width:1240px`
  unchanged. `tools/selftest.mjs` asserts no scroll at 1440×900.
- `0.798` appears in `mult()` only — it is the mean-absolute correction for a single
  `|finalDelta|`, and is wrong anywhere else.
- `FEE_K` stays at 0.07, verified against Kalshi's schedule effective 7 Jul 2026.
- `edge.log.v3` is never deleted or migrated. Pre-fix rows stay for hit-rate history;
  only `refitB` filters them out, via the `v: 2` stamp.
