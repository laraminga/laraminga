#!/usr/bin/env node
/* ──────────────────────────────────────────────────────────────────────
   La Raminga — static site build
   Produces a self-contained dist/ folder:
     • single inlined HTML (CSS, JS and locale data baked in)
     • IT pre-rendered into the markup for SEO + no-JS users
     • static gallery + service cards (no client-side render needed
       for the initial paint)
     • JSON-LD Restaurant schema
     • sitemap.xml, robots.txt
     • original image/font/CNAME assets copied through
   Usage:  node build.mjs
   ────────────────────────────────────────────────────────────────────── */

import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── config ──────────────────────────────────────────────────────────────
const SITE = {
  url: 'https://laraminga.com',
  hero: 'terrace-dining-table-mountain-view',
  phone: '+393471457329',
  email: 'vale.sfra@hotmail.it',
  defaultLocale: 'it',
  region: 'Tuscany',
  locality: 'Lunigiana',
  country: 'IT',
  cuisines: ['Italian', 'Mediterranean', 'Vegetarian', 'Home Cooking'],
  priceRange: '€€',
};

// Service-card image config — keep in sync with assets/js/site.js
const SERVICE_IMG = [
  { src: 'terrace-table-blue-plates-mountains' },
  { src: 'savory-cheesecake-plated-above-sauce', pos: 'center 25%' },
  { src: 'bowls-pesto-purple-cream-condiments' },
];

// Gallery list — order matters
const GALLERY = [
  'eggplant-parmigiana-white-marble-plate',
  'pea-vines-flowering-green-tendrils',
  'peas-climbing-beside-onion-bed',
  'golden-focaccia-bread-crusty-dimples',
  'beets-onions-sprouting-garden-row',
  'radicchio-halves-cutting-board-purple',
  'three-dumplings-wooden-cutting-board',
  'fresh-pasta-sheets-dusted-flour',
  'handmade-casoncelli-dumplings-flour-tray',
  'terrace-herb-garden-potted-plants',
  'savory-cheesecake-vegetable-ribbons-sauce',
  'tiny-clover-sprouts-purple-green',
  'poached-egg-green-chard-sauce',
  'seed-crackers-wooden-bowl-chunks',
  'roasted-tomatoes-herbs-olive-oil',
  'cold-frame-growing-young-leeks',
  'spinach-seedlings-rooted-dry-ground',
  'grilled-eggplant-slices-basil-leaves',
  'tagliatelle-green-pesto-walnuts-parmesan',
  'tomato-plant-blooming-yellow-flowers',
  'freshly-harvested-green-olives-crate',
  'roasted-sweet-potato-garlic-cloves',
  'parmigiana-basil-leaves-outdoor-table',
  'cold-frame-garlic-shoots-glass',
  'folded-crepe-topped-chestnut-preserve',
  'savoy-cabbage-rolls-stuffed-packed',
  'bowls-pesto-purple-cream-condiments',
  'savory-cheesecake-plated-above-sauce',
  'terrace-table-blue-plates-mountains',
  'terrace-dining-table-mountain-view',
];

// ─── paths + helpers ─────────────────────────────────────────────────────
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const TMP  = await fs.mkdtemp(path.join(os.tmpdir(), 'la-raminga-'));

const p  = (...parts) => path.join(ROOT, ...parts);
const pd = (...parts) => path.join(DIST, ...parts);

const log = (m) => console.log(`• ${m}`);
const npx = (pkg, args, opts = {}) =>
  execFileSync('npx', ['--yes', pkg, ...args], { stdio: ['pipe', 'pipe', 'inherit'], ...opts });
const readJson = async (rel) => JSON.parse(await fs.readFile(p(rel), 'utf8'));

const escAttr = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const escHtml = (s) =>
  String(s ?? '').replace(/[&<>]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));

const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);

const altFromName = (n) => n.replace(/[-_]/g, ' ');

async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  for (const e of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else if (e.isFile()) await fs.copyFile(s, d);
  }
}

async function dirSize(p) {
  const st = await fs.stat(p);
  if (!st.isDirectory()) return st.size;
  let total = 0;
  for (const e of await fs.readdir(p, { withFileTypes: true })) total += await dirSize(path.join(p, e.name));
  return total;
}
const fmt = (b) =>
  b < 1024 ? `${b}B`
    : b < 1024 ** 2 ? `${(b / 1024).toFixed(1)}KB`
    : `${(b / 1024 ** 2).toFixed(2)}MB`;

// ─── pipeline ────────────────────────────────────────────────────────────
const t0 = Date.now();

await clean();
await copyAssets();

const fontsCss = await prepareFontsCss();
const tailwind = await compileTailwind();
const css      = await bundleCss(fontsCss, tailwind);
const locales  = { it: await readJson('locales/it.json'), en: await readJson('locales/en.json') };
const js       = await bundleJs(locales);

await buildHtml({ css, js, locales });
await writeSitemap();
await writeRobots();

await report();

// ─── steps ───────────────────────────────────────────────────────────────

async function clean() {
  log('clean dist/');
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });
}

async function copyAssets() {
  log('copy img/, fonts/, .nojekyll, CNAME');
  await copyDir(p('img'),   pd('img'));
  await copyDir(p('fonts'), pd('fonts'));
  for (const f of ['.nojekyll', 'CNAME']) {
    try { await fs.copyFile(p(f), pd(f)); } catch {}
  }
}

async function prepareFontsCss() {
  let css = await fs.readFile(p('fonts/fonts.css'), 'utf8');
  // url(file.woff2) → url(fonts/file.woff2) — for inlining into a single stylesheet
  return css.replace(/url\(([^)]+\.woff2)\)/g, (_, f) => `url(fonts/${f.trim()})`);
}

async function compileTailwind() {
  log('compile tailwind (purged + minified)');
  const cfg = path.join(TMP, 'tw.config.cjs');
  const inp = path.join(TMP, 'tw.in.css');
  const out = path.join(TMP, 'tw.out.css');

  await fs.writeFile(cfg, `module.exports = {
  content: [
    ${JSON.stringify(p('index.html'))},
    ${JSON.stringify(p('assets/js/site.js'))},
    ${JSON.stringify(fileURLToPath(import.meta.url))},
  ],
  theme: { extend: {
    colors: {
      cream: '#fbf5e7', butter: '#fdf8f0', brick: '#c25539', terra: '#a23f24',
      sage: '#7a8d5a', sageDark: '#566840', ochre: '#d4a149', ink: '#2a1f17',
      washSky: '#e6eff1', washHoney: '#faf2dc', washSage: '#eef2e1',
      washRose: '#f9ebdf', washBeige: '#f3ecd9',
      skyDeep: '#2f5763', honeyDeep: '#6b591e', sageDeep: '#4f5a2a',
      roseDeep: '#74391f', beigeDeep: '#5d4a1c',
    },
    fontFamily: {
      hand: ['"Dancing Script"', 'cursive'],
      serif: ['Lora', 'Georgia', 'serif'],
    },
  }},
};
`);
  await fs.writeFile(inp, '@tailwind base;@tailwind components;@tailwind utilities;\n');

  npx('tailwindcss@3', ['-c', cfg, '-i', inp, '-o', out, '--minify'],
    { stdio: ['ignore', 'inherit', 'inherit'] });
  return fs.readFile(out, 'utf8');
}

async function bundleCss(fontsCss, tailwindCss) {
  log('bundle + minify css');
  const site = await fs.readFile(p('assets/css/site.css'), 'utf8');
  const combined = path.join(TMP, 'combined.css');
  await fs.writeFile(combined, [fontsCss, tailwindCss, site].join('\n'));
  return npx('clean-css-cli@5', ['--inline', 'none', combined]).toString('utf8');
}

async function bundleJs(locales) {
  log('bundle + minify js');
  const src = await fs.readFile(p('assets/js/site.js'), 'utf8');
  const inp = path.join(TMP, 'site.in.js');
  // expose locales as a global before the IIFE so the script can pick them up
  await fs.writeFile(inp,
    `window.__LOCALES__=${JSON.stringify(locales)};\n${src}`);
  return npx('terser@5', [inp, '--compress', '--mangle']).toString('utf8');
}

async function buildHtml({ css, js, locales }) {
  log('pre-render html for default locale');
  const it = locales[SITE.defaultLocale];
  let html = await fs.readFile(p('index.html'), 'utf8');

  // mark the document so JS knows it can skip the initial render pass
  html = html.replace('<html lang="it">', '<html lang="it" data-prerender="it">');

  // strip dev-only refs (the inline build replaces them)
  html = html
    .replace(/\s*<link[^>]+href="fonts\/fonts\.css"[^>]*>/g, '')
    .replace(/\s*<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/g, '')
    .replace(/\s*<script>\s*tailwind\.config\s*=[\s\S]*?<\/script>/g, '')
    .replace(/\s*<link[^>]+href="assets\/css\/site\.css[^"]*"[^>]*>/g, '')
    .replace(/\s*<script[^>]*src="assets\/js\/site\.js[^"]*"[^>]*><\/script>/g, '');

  // pre-render locale text (default locale into the static markup)
  html = preRender(html, it);

  // pre-fill data-whatsapp hrefs
  const waHref =
    `https://wa.me/${SITE.phone.replace(/\D/g, '')}?text=${encodeURIComponent(it.whatsappMessage || '')}`;
  html = html.replace(
    /<a([^>]*?)\sdata-whatsapp([^>]*?)>/g,
    (_, before, after) => {
      const stripHref = (s) => s.replace(/\s+href="[^"]*"/, '');
      return `<a${stripHref(before)} href="${escAttr(waHref)}" data-whatsapp${stripHref(after)}>`;
    }
  );

  // expand placeholders
  html = html.replace('<!-- @gallery -->',  renderGallery());
  html = html.replace('<!-- @services -->', renderServices(it, waHref));
  html = html.replace('<!-- @jsonld -->',   renderJsonLd(it));

  // preload the woff2s (now we know they're inlined-referenced via fonts/…)
  const preloads = [
    `<link rel="preload" as="font" type="font/woff2" href="fonts/dancing-script-latin.woff2" crossorigin>`,
    `<link rel="preload" as="font" type="font/woff2" href="fonts/lora-latin.woff2" crossorigin>`,
  ].join('');

  // inline the bundled css + js
  html = html.replace('</head>', `${preloads}<style>${css}</style></head>`);
  html = html.replace('</body>', `<script>${js}</script></body>`);

  log('minify html');
  const inp = path.join(TMP, 'index.in.html');
  await fs.writeFile(inp, html);
  const minified = npx('html-minifier-terser@7', [
    inp,
    '--collapse-whitespace',
    '--remove-comments',
    '--remove-redundant-attributes',
    '--remove-script-type-attributes',
    '--remove-style-link-type-attributes',
    '--use-short-doctype',
    '--minify-css',  'false',
    '--minify-js',   'false',
  ]).toString('utf8');

  await fs.writeFile(pd('index.html'), minified);
}

// ─── pre-render helpers ──────────────────────────────────────────────────

/**
 * Replace data-i18n placeholders in the source HTML with the matching string
 * from `locale`:
 *  • <tag … data-i18n="key" data-i18n-attr="X">    → set attribute X
 *  • <tag … data-i18n="key">…</tag>                → fill text content
 * The data-i18n attribute is preserved so runtime locale switching still works.
 */
function preRender(html, locale) {
  // attribute mode (covers <meta>, <link> and any self-closing tags)
  html = html.replace(
    /<(\w+)([^>]*?)\sdata-i18n="([^"]+)"([^>]*?)\sdata-i18n-attr="([^"]+)"([^>]*?)\/?>/g,
    (full, tag, p1, key, p2, attr, p3) => {
      const v = get(locale, key);
      if (typeof v !== 'string') return full;
      const stripAttr = (s) => s.replace(new RegExp(`\\s+${attr}="[^"]*"`, 'g'), '');
      const before = stripAttr(p1);
      const middle = stripAttr(p2);
      const after  = stripAttr(p3);
      return `<${tag}${before} data-i18n="${key}"${middle} data-i18n-attr="${attr}"${after} ${attr}="${escAttr(v)}">`;
    }
  );

  // text-content mode — only when there's no data-i18n-attr in the tag
  html = html.replace(
    /<(\w+)([^>]*?)\sdata-i18n="([^"]+)"([^>]*)>([^<]*)<\/\1>/g,
    (full, tag, p1, key, p2, _txt) => {
      if ((p1 + p2).includes('data-i18n-attr')) return full;
      const v = get(locale, key);
      if (typeof v !== 'string') return full;
      return `<${tag}${p1} data-i18n="${key}"${p2}>${escHtml(v)}</${tag}>`;
    }
  );

  return html;
}

function renderGallery() {
  return GALLERY
    .map((name) => {
      const alt = altFromName(name);
      return `<figure><picture><source srcset="img/${name}.webp" type="image/webp"><img src="img/${name}.jpeg" alt="${escAttr(alt)}" loading="lazy" decoding="async"></picture></figure>`;
    })
    .join('');
}

function renderServices(locale, waHref) {
  const items = locale.services?.items || [];
  return items
    .map((s, i) => {
      const cfg = SERVICE_IMG[i] || SERVICE_IMG[0];
      const pos = cfg.pos ? ` style="object-position:${cfg.pos}"` : '';
      const details = (s.details || []).map((d) => `<li>${escHtml(d)}</li>`).join('');
      return [
        `<article class="flex flex-col bg-white rounded-2xl overflow-hidden border border-ochre/20 shadow-sm">`,
          `<div class="aspect-[5/3] overflow-hidden bg-cream">`,
            `<picture>`,
              `<source srcset="img/${cfg.src}.webp" type="image/webp">`,
              `<img src="img/${cfg.src}.jpeg" alt="${escAttr(altFromName(cfg.src))}" loading="lazy" decoding="async" class="w-full h-full object-cover"${pos}>`,
            `</picture>`,
          `</div>`,
          `<div class="p-6 md:p-7 flex-1 flex flex-col">`,
            `<h3 class="text-2xl font-semibold">${escHtml(s.title)}</h3>`,
            `<p class="mt-3 leading-relaxed">${escHtml(s.body)}</p>`,
            `<ul class="bullet-list mt-5 space-y-1.5 list-none">${details}</ul>`,
            `<div class="mt-auto pt-5">`,
              `<a href="${escAttr(waHref)}" target="_blank" rel="noopener" class="inline-flex items-center justify-center bg-brick hover:bg-terra text-white px-5 py-3 rounded-full font-medium transition">${escHtml(s.cta)}</a>`,
            `</div>`,
          `</div>`,
        `</article>`,
      ].join('');
    })
    .join('');
}

function renderJsonLd(it) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: 'La Raminga',
    description: it.meta?.description || '',
    url: SITE.url + '/',
    image: `${SITE.url}/img/${SITE.hero}.jpeg`,
    telephone: SITE.phone,
    email: SITE.email,
    address: {
      '@type': 'PostalAddress',
      addressRegion: SITE.region,
      addressLocality: SITE.locality,
      addressCountry: SITE.country,
    },
    servesCuisine: SITE.cuisines,
    priceRange: SITE.priceRange,
    inLanguage: ['it', 'en'],
    founder: { '@type': 'Person', name: 'Valentina Del Frate' },
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

// ─── sitemap + robots ────────────────────────────────────────────────────

async function writeSitemap() {
  log('write sitemap.xml');
  const today = new Date().toISOString().slice(0, 10);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ',
    'xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    '<url>',
    `<loc>${SITE.url}/</loc>`,
    `<lastmod>${today}</lastmod>`,
    '<changefreq>monthly</changefreq>',
    '<priority>1.0</priority>',
    `<xhtml:link rel="alternate" hreflang="it" href="${SITE.url}/"/>`,
    `<xhtml:link rel="alternate" hreflang="en" href="${SITE.url}/"/>`,
    `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE.url}/"/>`,
    '</url>',
    '</urlset>',
  ].join('');
  await fs.writeFile(pd('sitemap.xml'), xml);
}

async function writeRobots() {
  log('write robots.txt');
  await fs.writeFile(
    pd('robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`
  );
}

// ─── final report ────────────────────────────────────────────────────────

async function report() {
  await fs.rm(TMP, { recursive: true, force: true });
  const html = (await fs.stat(pd('index.html'))).size;
  const total = await dirSize(DIST);
  const ms = Date.now() - t0;
  console.log('');
  console.log(`✓ dist/index.html  ${fmt(html)}`);
  console.log(`✓ dist/ total      ${fmt(total)}`);
  console.log(`✓ ${(ms / 1000).toFixed(1)}s`);
}
