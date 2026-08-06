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

/* Proof that inject(extract(x)) === x. Run before trusting the round trip. */
export function verify() {
  const html = readFileSync(BUNDLE, 'utf8');
  const m = html.match(BLOCK);
  if (!m) throw new Error('template block not found');
  const round = encode(JSON.parse(m[2]));
  return { identical: round === m[2], original: m[2].length, round: round.length };
}

const cmd = process.argv[2];
if (cmd === 'extract') console.log('extracted', extract().bytes, 'bytes ->', SRC);
else if (cmd === 'inject') console.log('injected', inject().bytes, 'bytes ->', BUNDLE);
else if (cmd === 'verify') console.log(verify());
else if (cmd) throw new Error('unknown command: ' + cmd);
