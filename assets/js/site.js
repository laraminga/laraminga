/* ──────────────────────────────────────────────────────────────────────
   La Raminga — runtime
   • Locale switch (it / en) — flips data-i18n text/attribute strings.
     Service cards live as static HTML in index.html (IT only).
   • Header scroll state.
   • Mobile burger menu (open/close + close-on-scroll).
   ────────────────────────────────────────────────────────────────────── */

(() => {
  const PHONE = '393471457329';
  const STORE = 'la-raminga-lang';

  // Locale data is inlined by the build script as window.__LOCALES__.
  // In dev (no build), fall back to fetch().
  const LOCALES = (typeof window !== 'undefined' && window.__LOCALES__) || null;

  let active = null;

  // ─── helpers ──────────────────────────────────────────────────────────
  const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  const wa = (msg) =>
    `https://wa.me/${PHONE}?text=${encodeURIComponent(msg ?? '')}`;

  async function fetchLocale(loc) {
    if (LOCALES) return LOCALES[loc];
    const res = await fetch(`locales/${loc}.json`);
    if (!res.ok) throw new Error('locale fetch failed');
    return res.json();
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

  // ─── lightbox ─────────────────────────────────────────────────────────
  function bindLightbox() {
    const box = document.getElementById('lightbox');
    if (!box) return;
    const big = box.querySelector('img');

    const open = (src, alt) => {
      big.src = src;
      big.alt = alt || '';
      box.hidden = false;
      box.setAttribute('aria-hidden', 'false');
      document.documentElement.style.overflow = 'hidden';
    };
    const close = () => {
      box.hidden = true;
      box.setAttribute('aria-hidden', 'true');
      big.removeAttribute('src');
      document.documentElement.style.overflow = '';
    };

    document.querySelectorAll('.menus img, .gallery img').forEach((img) => {
      img.addEventListener('click', () => open(img.currentSrc || img.src, img.alt));
    });

    box.addEventListener('click', close);
    addEventListener('keydown', (e) => {
      if (!box.hidden && e.key === 'Escape') close();
    });
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
    bindLightbox();

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
