/* Bundle tooling for the BTC Session Edge v3 artifact.
 *
 * The shipped artifact (index.html) is a self-extracting bundle: a loader
 * script plus three JSON blocks — __bundler/manifest (gzip+base64 assets,
 * including the sessData dataset module and vendored React),
 * __bundler/ext_resources (id -> uuid), and __bundler/template (the real
 * <x-dc> document, stored as a JSON string).
 *
 * All application logic lives in that template block, so editing the bundle
 * directly would mean patching inside JSON escaping — unreviewable in a diff.
 * These two commands split that apart:
 *
 *   node tools/bundle.mjs extract   index.html -> src/app.html
 *   node tools/bundle.mjs inject    src/app.html -> index.html
 *
 * inject is the exact inverse of extract: JSON.stringify, then re-escape "</"
 * as "</" the way the original bundler did, so an embedded </script> in
 * the template cannot terminate the outer script block early.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = join(ROOT, 'index.html');
const SRC = join(ROOT, 'src', 'app.html');
/* The Vercel project builds from web/, so anything outside it is never
   deployed. This copy is what the hosted URL actually serves; `deploy` refreshes
   it and `verify` fails if it has drifted from the canonical bundle. */
const DEPLOYED = join(ROOT, '..', 'web', 'public', 'btc-session-edge-v3.html');

/* The template block, captured so we can swap only its payload. */
const BLOCK = /(<script type="__bundler\/template">\n)([\s\S]*?)(\n  <\/script>)/;

/* The bundler escapes forward slashes in "</" as /. JSON.stringify does
   not, so reapply it — otherwise a </script> inside the template closes the
   wrapper tag and the page dies at parse time. */
const encode = (s) => JSON.stringify(s).replace(/<\//g, '<\\u002F');

export function extract() {
  const html = readFileSync(BUNDLE, 'utf8');
  const m = html.match(BLOCK);
  if (!m) throw new Error('template block not found in ' + BUNDLE);
  const tpl = JSON.parse(m[2]);
  writeFileSync(SRC, tpl);
  return { bytes: tpl.length };
}

export function inject() {
  const html = readFileSync(BUNDLE, 'utf8');
  const tpl = readFileSync(SRC, 'utf8');
  const m = html.match(BLOCK);
  if (!m) throw new Error('template block not found in ' + BUNDLE);
  const out = html.replace(BLOCK, (_, open, __, close) => open + encode(tpl) + close);
  writeFileSync(BUNDLE, out);
  return { bytes: tpl.length };
}

/* Two proofs, both of which must hold for the shipped file to be trustworthy:
   1. encode(decode(x)) === x — the round trip loses nothing.
   2. the bundle's template === src/app.html — nobody edited the source and
      forgot to inject, which would ship the old app with a new-looking diff. */
export function verify() {
  const html = readFileSync(BUNDLE, 'utf8');
  const m = html.match(BLOCK);
  if (!m) throw new Error('template block not found');
  const decoded = JSON.parse(m[2]);
  const round = encode(decoded);
  let deployedMatches = null;
  try { deployedMatches = readFileSync(DEPLOYED, 'utf8') === html; } catch { /* not deployed */ }
  return {
    roundTripIdentical: round === m[2],
    bundleMatchesSrc: decoded === readFileSync(SRC, 'utf8'),
    deployedMatches,
    bytes: decoded.length
  };
}

/* Refresh the served copy from the canonical bundle. Run after inject(). */
export function deploy() {
  writeFileSync(DEPLOYED, readFileSync(BUNDLE));
  return { to: DEPLOYED };
}

const cmd = process.argv[2];
if (cmd === 'extract') console.log('extracted', extract().bytes, 'bytes ->', SRC);
else if (cmd === 'inject') console.log('injected', inject().bytes, 'bytes ->', BUNDLE);
else if (cmd === 'verify') {
  const v = verify();
  console.log(v);
  if (!v.roundTripIdentical) console.error('FAIL: bundle round trip is lossy');
  if (!v.bundleMatchesSrc) console.error('FAIL: index.html is stale — run `node tools/bundle.mjs inject`');
  if (v.deployedMatches === false) console.error('FAIL: web/public copy is stale — run `node tools/bundle.mjs deploy`');
  process.exit(v.roundTripIdentical && v.bundleMatchesSrc && v.deployedMatches !== false ? 0 : 1);
}
else if (cmd === 'deploy') console.log('deployed ->', deploy().to);
else if (cmd) throw new Error('unknown command: ' + cmd);
