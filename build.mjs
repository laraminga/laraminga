#!/usr/bin/env node
// Build a self-contained, lightning-fast dist/ folder for the static site.
// Run: `node build.mjs`

import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'la-raminga-build-'));

const log = (...a) => console.log('•', ...a);
const npx = (pkg, args, opts = {}) =>
  execFileSync('npx', ['--yes', pkg, ...args], { stdio: ['pipe', 'pipe', 'inherit'], ...opts });

async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  for (const e of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else if (e.isFile()) await fs.copyFile(s, d);
  }
}

// ── 1. clean & scaffold ─────────────────────────────────────────────────────
log('cleaning dist/');
await fs.rm(DIST, { recursive: true, force: true });
await fs.mkdir(DIST, { recursive: true });

// ── 2. copy static assets ───────────────────────────────────────────────────
log('copying img/, fonts/, .nojekyll, CNAME');
await copyDir(path.join(ROOT, 'img'), path.join(DIST, 'img'));
await copyDir(path.join(ROOT, 'fonts'), path.join(DIST, 'fonts'));
await fs.copyFile(path.join(ROOT, '.nojekyll'), path.join(DIST, '.nojekyll'));
await fs.copyFile(path.join(ROOT, 'CNAME'), path.join(DIST, 'CNAME'));

// ── 3. read fonts.css and rewrite same-dir url() → fonts/<file> for inlining
log('preparing fonts.css for inlining');
let fontsCss = await fs.readFile(path.join(ROOT, 'fonts/fonts.css'), 'utf8');
fontsCss = fontsCss.replace(/url\(([^)]+\.woff2)\)/g, (_, f) => `url(fonts/${f.trim()})`);

// ── 4. generate purged Tailwind CSS ─────────────────────────────────────────
log('compiling Tailwind (purged)');
const twConfigPath = path.join(TMP, 'tailwind.config.cjs');
const twInputPath = path.join(TMP, 'tw-in.css');
const twOutPath = path.join(TMP, 'tw-out.css');

await fs.writeFile(
  twConfigPath,
  `module.exports = {
  content: [
    ${JSON.stringify(path.join(ROOT, 'index.html'))},
    ${JSON.stringify(path.join(ROOT, 'assets/js/site.js'))},
  ],
  theme: {
    extend: {
      colors: {
        cream: '#fbf5e7', butter: '#fdf8f0', brick: '#c25539', terra: '#a23f24',
        sage: '#7a8d5a', sageDark: '#566840', ochre: '#d4a149', ink: '#2a1f17',
        washSky: '#d3e2e6', washHoney: '#f5e9c6', washSage: '#e6ecd6',
        washRose: '#f3dcce', washBeige: '#ece1c4',
        skyDeep: '#2f5763', honeyDeep: '#6b591e', sageDeep: '#4f5a2a',
        roseDeep: '#74391f', beigeDeep: '#5d4a1c',
      },
      fontFamily: {
        hand: ['"Dancing Script"', 'cursive'],
        serif: ['Lora', 'Georgia', 'serif'],
      },
    },
  },
};
`
);
await fs.writeFile(twInputPath, '@tailwind base;@tailwind components;@tailwind utilities;\n');

npx('tailwindcss@3', ['-c', twConfigPath, '-i', twInputPath, '-o', twOutPath, '--minify'],
  { stdio: ['ignore', 'inherit', 'inherit'] });

const tailwindCss = await fs.readFile(twOutPath, 'utf8');

// ── 5. bundle + minify CSS ──────────────────────────────────────────────────
log('bundling + minifying CSS');
const siteCss = await fs.readFile(path.join(ROOT, 'assets/css/site.css'), 'utf8');
const combinedCssPath = path.join(TMP, 'combined.css');
await fs.writeFile(combinedCssPath, [fontsCss, tailwindCss, siteCss].join('\n'));
const minifiedCss = npx('clean-css-cli@5', ['--inline', 'none', combinedCssPath]).toString('utf8');

// ── 6. inline locales ───────────────────────────────────────────────────────
log('inlining locales');
const it = JSON.parse(await fs.readFile(path.join(ROOT, 'locales/it.json'), 'utf8'));
const en = JSON.parse(await fs.readFile(path.join(ROOT, 'locales/en.json'), 'utf8'));
const localesPrelude = `var __LOCALES__=${JSON.stringify({ it, en })};`;

// ── 7. patch + minify JS ────────────────────────────────────────────────────
log('patching + minifying site.js');
let siteJs = await fs.readFile(path.join(ROOT, 'assets/js/site.js'), 'utf8');
siteJs = siteJs.replace(
  /async function loadLocale\(locale\) \{[\s\S]*?\n\s*\}\n/,
  `async function loadLocale(locale){
    const data=__LOCALES__[locale];
    if(!data) throw new Error('Missing locale '+locale);
    return data;
  }\n`
);
const jsInPath = path.join(TMP, 'site.in.js');
await fs.writeFile(jsInPath, localesPrelude + '\n' + siteJs);
const minifiedJs = npx('terser@5', [jsInPath, '--compress', '--mangle']).toString('utf8');

// ── 8. rewrite + minify HTML ────────────────────────────────────────────────
log('rewriting + minifying HTML');
let html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');

// strip the local fonts.css link (its content is being inlined)
html = html.replace(/\s*<link[^>]+href="fonts\/fonts\.css"[^>]*>\s*/g, '\n');
// strip Tailwind CDN script + the inline tailwind.config block
html = html.replace(/\s*<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>\s*/g, '\n');
html = html.replace(/\s*<script>\s*tailwind\.config\s*=\s*\{[\s\S]*?\};?\s*<\/script>\s*/g, '\n');
// strip external site.css link + external site.js script
html = html.replace(/\s*<link[^>]+href="assets\/css\/site\.css[^"]*"[^>]*>\s*/g, '\n');
html = html.replace(/\s*<script src="assets\/js\/site\.js[^"]*"><\/script>\s*/g, '\n');

// preload above-the-fold fonts (Dancing Script 700, Lora 400)
const pickFont = (family, weight) => {
  const re = new RegExp(
    `@font-face\\s*\\{[^}]*font-family:\\s*'${family}'[^}]*font-weight:\\s*${weight}[^}]*url\\(fonts\\/([^)]+\\.woff2)\\)`,
    'i'
  );
  const m = fontsCss.match(re);
  return m ? m[1] : null;
};
const preloadTags = [pickFont('Dancing Script', 700), pickFont('Lora', 400)]
  .filter(Boolean)
  .map((h) => `<link rel="preload" as="font" type="font/woff2" href="fonts/${h}" crossorigin>`)
  .join('');

html = html.replace(/<\/head>/, `${preloadTags}<style>${minifiedCss}</style></head>`);
html = html.replace(/<\/body>/, `<script>${minifiedJs}</script></body>`);

const htmlInPath = path.join(TMP, 'index.in.html');
await fs.writeFile(htmlInPath, html);
const minifiedHtml = npx('html-minifier-terser@7', [
  htmlInPath,
  '--collapse-whitespace', '--remove-comments',
  '--remove-redundant-attributes',
  '--remove-script-type-attributes',
  '--remove-style-link-type-attributes',
  '--use-short-doctype',
  '--minify-css', 'false', '--minify-js', 'false',
]).toString('utf8');

await fs.writeFile(path.join(DIST, 'index.html'), minifiedHtml);

// ── 9. report ───────────────────────────────────────────────────────────────
async function du(p) {
  const st = await fs.stat(p);
  if (!st.isDirectory()) return st.size;
  let total = 0;
  for (const e of await fs.readdir(p, { withFileTypes: true })) total += await du(path.join(p, e.name));
  return total;
}
const fmt = (b) => (b < 1024 ? `${b}B` : b < 1024 ** 2 ? `${(b / 1024).toFixed(1)}KB` : `${(b / 1024 ** 2).toFixed(2)}MB`);
const htmlSize = (await fs.stat(path.join(DIST, 'index.html'))).size;
const distSize = await du(DIST);
await fs.rm(TMP, { recursive: true, force: true });

console.log('');
console.log(`✓ dist/index.html  ${fmt(htmlSize)}`);
console.log(`✓ dist/ total      ${fmt(distSize)}`);
console.log(`✓ done`);
