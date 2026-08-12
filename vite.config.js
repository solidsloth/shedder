import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Fold the built CSS and JS back into index.html.
 *
 * The demo has always been one file you can open straight off disk over
 * `file://` — no server, no build step, hand it to someone and it works. A
 * normal Vite build breaks that: ES modules loaded from a separate `assets/`
 * file are blocked by CORS on `file://`. Inline scripts are not, so folding
 * everything back into the HTML keeps the old property and still produces
 * exactly what GitHub Pages wants.
 *
 * Replacements use a function rather than a string because the bundle is full
 * of `$` — every `$('id')` helper and every `${}` in a template literal would
 * otherwise be eaten as a `String.replace` substitution pattern.
 */
function inlineEverything() {
  return {
    name: 'inline-everything',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find((f) => f.fileName.endsWith('.html'));
      if (!html) return;

      const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let out = html.source;

      for (const file of Object.values(bundle)) {
        if (file === html) continue;
        const name = escape(file.fileName);

        if (file.type === 'asset' && file.fileName.endsWith('.css')) {
          const link = new RegExp(`<link[^>]+href="[^"]*${name}"[^>]*>`);
          if (!link.test(out)) throw new Error(`no <link> found for ${file.fileName}`);
          out = out.replace(link, () => `<style>\n${file.source}</style>`);
          delete bundle[file.fileName];
        } else if (file.type === 'chunk') {
          const tag = new RegExp(`<script[^>]+src="[^"]*${name}"[^>]*></script>`);
          if (!tag.test(out)) throw new Error(`no <script> found for ${file.fileName}`);
          out = out.replace(tag, () => `<script type="module">\n${file.code}</script>`);
          delete bundle[file.fileName];
        }
      }

      html.source = out;
    },
  };
}

export default defineConfig({
  // Relative so the single file works from any path — a Pages sub-directory,
  // or straight off the filesystem.
  base: './',
  resolve: {
    // shadcn generates components that import from '@/...'.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // build/ rather than Vite's default dist/: the Pages workflow uploads it.
    outDir: 'build',
    emptyOutDir: true,
    // One CSS file and one JS chunk, with nothing preloading a file that
    // inlineEverything is about to delete. There are no dynamic imports, so a
    // single entry already yields a single chunk.
    cssCodeSplit: false,
    modulePreload: false,
  },
  plugins: [react(), tailwindcss(), inlineEverything()],
});
