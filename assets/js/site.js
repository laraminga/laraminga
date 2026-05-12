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
  // Click an image in .menus or .gallery → fullscreen slideshow scoped to
  // that group. Arrows + dots + keyboard + swipe.
  function bindLightbox() {
    const box = document.getElementById('lightbox');
    if (!box) return;
    const big   = box.querySelector('img');
    const stage = box.querySelector('.lb-stage');
    const counter = box.querySelector('.lb-counter');
    const btnPrev  = box.querySelector('.lb-prev');
    const btnNext  = box.querySelector('.lb-next');
    const btnClose = box.querySelector('.lb-close');

    let group = [];   // [{src, alt}, …]
    let idx   = 0;

    const render = () => {
      const item = group[idx];
      if (!item) return;
      big.src = item.src;
      big.alt = item.alt || '';
      const many = group.length > 1;
      btnPrev.hidden = !many;
      btnNext.hidden = !many;
      counter.hidden = !many;
      if (many) counter.textContent = `${idx + 1} / ${group.length}`;
    };

    const open = (imgs, startIdx) => {
      group = [...imgs].map((im) => ({
        src: im.currentSrc || im.src,
        alt: im.alt
      }));
      idx = startIdx;
      render();
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
    const next = () => { idx = (idx + 1) % group.length; render(); };
    const prev = () => { idx = (idx - 1 + group.length) % group.length; render(); };

    document.querySelectorAll('.menus, .gallery').forEach((grid) => {
      const imgs = [...grid.querySelectorAll('img')];
      imgs.forEach((img, i) => {
        img.addEventListener('click', () => open(imgs, i));
      });
    });

    // Clicks inside the lightbox: backdrop closes; everything else doesn't.
    box.addEventListener('click', (e) => {
      if (e.target === box || e.target === stage) close();
    });
    btnClose.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    btnNext .addEventListener('click', (e) => { e.stopPropagation(); next();  });
    btnPrev .addEventListener('click', (e) => { e.stopPropagation(); prev();  });

    addEventListener('keydown', (e) => {
      if (box.hidden) return;
      if (e.key === 'Escape') { close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
    });

    // Mobile: tap on the image advances. Detect via pointer media query
    // so desktop mouse clicks on the image don't accidentally navigate.
    const isCoarse = matchMedia('(hover: none) and (pointer: coarse)');
    big.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isCoarse.matches && group.length > 1) next();
    });

    // Touch swipe (horizontal). Threshold: 50px or 15% of viewport width.
    let tx = 0, ty = 0, tracking = false;
    box.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      tx = e.touches[0].clientX; ty = e.touches[0].clientY; tracking = true;
    }, { passive: true });
    box.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - tx, dy = t.clientY - ty;
      const threshold = Math.max(50, innerWidth * 0.15);
      if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) next(); else prev();
      }
    }, { passive: true });
  }

  // ─── #prenota → scroll to contact section ─────────────────────────────
  // The hash points at the lead <p>, but visually we want the "Scrivimi"
  // title in view, so retarget the scroll to the contact section.
  function bindPrenotaScroll() {
    const contact = document.getElementById('contact');
    if (!contact) return;
    const go = () => {
      if (location.hash !== '#prenota') return;
      // Defer past the browser's own hash-jump.
      requestAnimationFrame(() => contact.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    addEventListener('hashchange', go);
    if (location.hash === '#prenota') {
      if (document.readyState === 'complete') go();
      else addEventListener('load', go);
    }
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
    bindPrenotaScroll();

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
