// Theming has two halves that must agree but can't share code: the blocking
// script in index.html, which runs before any module loads, and theme.ts,
// which takes over afterwards. These tests pin the contract between them, and
// pin the rule that keeps the dark sheet complete — every sheet colour is a
// token, and no component paints one inline.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { nextTheme, readStored, THEME_CYCLE, THEME_KEY, type Theme } from '../src/demo/theme.ts';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const html = read('index.html');
const css = read('src/demo/style.css');

// ── the cycle ────────────────────────────────────────────────────────────────

test('one button cycles system -> dark -> light -> system', () => {
  assert.equal(nextTheme('system'), 'dark');
  assert.equal(nextTheme('dark'), 'light');
  assert.equal(nextTheme('light'), 'system');
});

test('the cycle visits every theme and closes the loop', () => {
  const seen: Theme[] = ['system'];
  for (let i = 0; i < 3; i++) seen.push(nextTheme(seen[seen.length - 1]!));

  assert.deepEqual(seen, ['system', 'dark', 'light', 'system'], 'three presses return to start');
  assert.equal(new Set(seen).size, 3, 'every theme is reachable');
  // A theme cycling to itself would strand the user on it.
  for (const [from, to] of Object.entries(THEME_CYCLE)) {
    assert.notEqual(from, to, `${from} cycles to itself`);
  }
});

test('with nothing stored the button starts at system', () => {
  // readStored runs before any click; no localStorage in node is the same
  // situation as a first visit.
  assert.equal(readStored(), 'system');
});

// ── the pre-paint script ─────────────────────────────────────────────────────

/** Run the real inline script against stubbed globals. */
function resolveTheme(stored: string | null, osDark: boolean) {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'index.html should carry a blocking theme script');

  const classes = new Set<string>();
  const style: Record<string, string> = {};
  const ctx: Record<string, unknown> = {
    localStorage: { getItem: () => stored },
    matchMedia: (q: string) => ({ matches: q.includes('dark') && osDark }),
    document: {
      documentElement: {
        classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) },
        style,
      },
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  new vm.Script(script).runInContext(ctx);
  return { dark: classes.has('dark'), colorScheme: style.colorScheme };
}

test('the pre-paint script resolves every stored/OS combination', () => {
  const cases: [string | null, boolean, boolean, string][] = [
    [null, false, false, 'no preference, OS light'],
    [null, true, true, 'no preference, OS dark'],
    ['system', true, true, 'following system, OS dark'],
    ['system', false, false, 'following system, OS light'],
    ['dark', false, true, 'chose dark, OS light'],
    ['light', true, false, 'chose light, OS dark'],
    // Must match readStored() in theme.ts, which falls back to 'system'.
    // Disagreeing here means a flash of the wrong theme on load.
    ['garbage', true, true, 'unrecognised value follows the system'],
  ];
  for (const [stored, osDark, wantDark, why] of cases) {
    const got = resolveTheme(stored, osDark);
    assert.equal(got.dark, wantDark, why);
    // colorScheme is what retints scrollbars and the number steppers.
    assert.equal(got.colorScheme, wantDark ? 'dark' : 'light', `${why}: color-scheme`);
  }
});

test('a blocked localStorage does not take the page down', () => {
  // Safari private mode throws rather than returning null.
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
  const ctx: Record<string, unknown> = {
    localStorage: {
      getItem() {
        throw new Error('SecurityError');
      },
    },
    matchMedia: () => ({ matches: false }),
    document: { documentElement: { classList: { toggle: () => {} }, style: {} } },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  assert.doesNotThrow(() => new vm.Script(script).runInContext(ctx));
});

test('index.html and theme.ts agree on the storage key and class', () => {
  // THEME_KEY is imported, so a rename in theme.ts fails here rather than
  // silently orphaning the blocking script.
  assert.ok(html.includes(`'${THEME_KEY}'`), `index.html should read ${THEME_KEY}`);
  assert.ok(read('src/demo/theme.ts').includes("classList.toggle('dark'"));
  assert.ok(html.includes("classList.toggle('dark'"), 'index.html toggles .dark');
});

// ── palette completeness ─────────────────────────────────────────────────────

/** Custom-property names declared directly inside a block. */
function tokensIn(selector: RegExp): Set<string> {
  const body = css.match(selector)?.[1] ?? '';
  return new Set([...body.matchAll(/^\s*(--[a-z-]+)\s*:/gm)].map((m) => m[1]));
}

test('every light token has a dark counterpart', () => {
  const light = tokensIn(/:root\s*\{([\s\S]*?)\n\}/);
  const dark = tokensIn(/\.dark\s*\{([\s\S]*?)\n\}/);
  // Structural, not colour — no reason to restate them per theme.
  const structural = new Set(['--radius', '--mono']);

  assert.ok(light.size > 30, 'expected the full palette in :root');
  const missing = [...light].filter((t) => !dark.has(t) && !structural.has(t));
  assert.deepEqual(missing, [], 'these keep their light value on a dark ground');
  const orphans = [...dark].filter((t) => !light.has(t));
  assert.deepEqual(orphans, [], 'these are only defined for dark');
});

test('no sheet rule hardcodes a colour', () => {
  const rules = [...css.matchAll(/^\.sheet [^{]*\{[^}]*\}/gm)].map((m) => m[0]);
  assert.ok(rules.length > 20, 'expected the sheet rules to be found');
  const literal = rules.filter((r) => /#[0-9a-f]{3,8}\b/i.test(r));
  assert.deepEqual(literal, [], 'a literal colour here cannot follow the theme');
});

test('no drawing component paints a colour inline', () => {
  const dir = path.join(root, 'src/demo');
  const offenders = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.tsx'))
    .flatMap((f) =>
      [...fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/(?:fill|stroke)="#[0-9a-fA-F]{3,8}"/g)]
        .map((m) => `${f}: ${m[0]}`),
    );
  assert.deepEqual(offenders, [], 'use a class so the colour follows the theme');
});
