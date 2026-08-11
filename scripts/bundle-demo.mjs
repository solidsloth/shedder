// Inlines the compiled engine into demo/template.html, producing a single
// file that opens directly over file:// with no build step or server.
//
// Usage: node scripts/bundle-demo.mjs   (run after `tsc`, or via `npm run demo`)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const enginePath = path.join(root, 'dist', 'core', 'framing.js');
const templatePath = path.join(root, 'demo', 'template.html');
// index.html so the build/ directory can be served as-is by GitHub Pages.
const outPath = path.join(root, 'build', 'index.html');

let engineSrc;
try {
  engineSrc = readFileSync(enginePath, 'utf8');
} catch {
  console.error(`Compiled engine not found at ${enginePath}. Run \`npm run build\` first.`);
  process.exit(1);
}

// The template's <script type="module"> has no imports of its own; the
// compiled engine (also import-free — framing.ts has zero imports) is
// concatenated ahead of it. Strip only the `export` keyword so the
// declarations become ordinary module-scope bindings.
const inlinedEngine = engineSrc.replace(/^export (?=(const|function|interface|type|class)\b)/gm, '');

const template = readFileSync(templatePath, 'utf8');
if (!template.includes('/*__FRAMING__*/')) {
  console.error(`${templatePath} has no /*__FRAMING__*/ marker to replace.`);
  process.exit(1);
}
const bundled = template.replace('/*__FRAMING__*/', inlinedEngine);

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, bundled);
console.log(`Wrote ${path.relative(root, outPath)} (${(bundled.length / 1024).toFixed(0)} KB)`);
