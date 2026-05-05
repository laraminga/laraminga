/* ──────────────────────────────────────────────────────────────────────
   La Raminga — runtime
   • Locale switch (it / en) — content is pre-rendered for the default
     locale; this only re-renders on user toggle.
   • Header scroll state.
   • Mobile burger menu (open/close + close-on-scroll).
   • Service-card template (kept in sync with build.mjs).
   ────────────────────────────────────────────────────────────────────── */

(() => {
  const PHONE = '393471457329';
  const EMAIL = 'vale.sfra@hotmail.it';
  const STORE = 'la-raminga-lang';

  // Locale data is inlined by the build script as window.__LOCALES__.
  // In dev (no build), fall back to fetch().
  const LOCALES = (typeof window !== 'undefined' && window.__LOCALES__) || null;

  // Service-card image config — keep in sync with build.mjs
  const SERVICE_IMG = [
    { src: 'terrace-table-blue-plates-mountains' },
    { src: 'savory-cheesecake-plated-above-sauce', pos: 'center 25%' },
    { src: 'bowls-pesto-purple-cream-condiments' },
  ];

  let active = null;

  // ─── helpers ──────────────────────────────────────────────────────────
  const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
    );
  const wa = (msg) =>
    `https://wa.me/${PHONE}?text=${encodeURIComponent(msg ?? '')}`;

  async function fetchLocale(loc) {
    if (LOCALES) return LOCALES[loc];
    const res = await fetch(`locales/${loc}.json`);
    if (!res.ok) throw new Error('locale fetch failed');
    return res.json();
  }

  // ─── service-card template ────────────────────────────────────────────
  function serviceCard(s, i, msg) {
    const cfg = SERVICE_IMG[i] || SERVICE_IMG[0];
    const pos = cfg.pos ? ` style="object-position:${cfg.pos}"` : '';
    const list = (s.details || []).map((d) => `<li>${esc(d)}</li>`).join('');
    return `
      <article class="flex flex-col bg-white rounded-2xl overflow-hidden border border-ochre/20 shadow-sm">
        <div class="aspect-[5/3] overflow-hidden bg-cream">
          <picture>
            <source srcset="img/${cfg.src}.webp" type="image/webp">
            <img src="img/${cfg.src}.jpeg" alt="" loading="lazy" decoding="async" class="w-full h-full object-cover"${pos}>
          </picture>
        </div>
        <div class="p-6 md:p-7 flex-1 flex flex-col">
          <h3 class="text-2xl font-semibold">${esc(s.title)}</h3>
          <p class="mt-3 leading-relaxed">${esc(s.body)}</p>
          <ul class="bullet-list mt-5 space-y-1.5 list-none">${list}</ul>
          <div class="mt-auto pt-5">
            <a href="${wa(msg)}" target="_blank" rel="noopener"
              class="inline-flex items-center justify-center bg-brick hover:bg-terra text-white px-5 py-3 rounded-full font-medium transition">
              ${esc(s.cta)}
            </a>
          </div>
        </div>
      </article>`;
  }

  // ─── apply a locale to the DOM ────────────────────────────────────────
  function apply(data) {
    document.documentElement.lang = active;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const v = get(data, el.dataset.i18n);
      if (typeof v !== 'string') return;
      const a = el.dataset.i18nAttr;
      if (a) el.setAttribute(a, v);
      else el.textContent = v;
    });

    const list = document.getElementById('services-list');
    if (list && Array.isArray(data?.services?.items)) {
      const msg = data.whatsappMessage ?? '';
      list.innerHTML = data.services.items
        .map((s, i) => serviceCard(s, i, msg))
        .join('');
    }

    const href = wa(data?.whatsappMessage);
    document.querySelectorAll('[data-whatsapp]').forEach((a) => (a.href = href));
  }

  function syncFlags(loc) {
    document.querySelectorAll('[data-locale-btn]').forEach((b) => {
      const on = b.dataset.localeBtn === loc;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on);
    });
  }

  async function setLocale(loc) {
    if (active === loc) return;
    let data;
    try { data = await fetchLocale(loc); }
    catch { return; }
    if (!data) return;
    active = loc;
    apply(data);
    try { localStorage.setItem(STORE, loc); } catch {}
    syncFlags(loc);
  }

  function detect() {
    let s; try { s = localStorage.getItem(STORE); } catch {}
    if (s === 'it' || s === 'en') return s;
    const lang = (navigator.language || 'it').slice(0, 2).toLowerCase();
    return lang === 'en' ? 'en' : 'it';
  }

  // ─── header scroll state ──────────────────────────────────────────────
  function bindHeader() {
    const h = document.getElementById('header');
    if (!h) return;
    const sync = () => h.classList.toggle('scrolled', scrollY > 60);
    addEventListener('scroll', sync, { passive: true });
    sync();
  }

  // ─── mobile burger menu ───────────────────────────────────────────────
  function bindMobileNav() {
    const t = document.getElementById('nav-toggle');
    const m = document.getElementById('nav-menu');
    if (!t || !m) return;
    const isOpen = () => !m.classList.contains('hidden');
    const open  = () => { m.classList.remove('hidden'); t.setAttribute('aria-expanded', 'true');  };
    const close = () => { m.classList.add('hidden');    t.setAttribute('aria-expanded', 'false'); };
    t.addEventListener('click', () => (isOpen() ? close() : open()));
    m.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
    addEventListener('scroll', () => isOpen() && close(), { passive: true });
  }

  function bindLocale() {
    document.querySelectorAll('[data-locale-btn]').forEach((b) =>
      b.addEventListener('click', () => setLocale(b.dataset.localeBtn))
    );
  }

  // ─── boot ────────────────────────────────────────────────────────────
  function init() {
    bindHeader();
    bindMobileNav();
    bindLocale();

    const initial = detect();
    const pre = document.documentElement.dataset.prerender;

    if (pre && pre === initial && LOCALES) {
      // Page is already rendered in the wanted locale: just sync state
      // (no DOM thrash, no redundant text replacement).
      active = initial;
      syncFlags(initial);
    } else {
      setLocale(initial);
    }
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else init();
})();
