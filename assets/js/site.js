(() => {
  const PHONE = '393471457329';
  const STORE = 'la-raminga-lang';

  // Build inlines locale data as window.__LOCALES__; in dev we fetch instead.
  const LOCALES = (typeof window !== 'undefined' && window.__LOCALES__) || null;

  let active = null;

  const get = (obj, path) => path.split('.').reduce((node, key) => (node == null ? node : node[key]), obj);
  const whatsappLink = (msg) =>
    `https://wa.me/${PHONE}?text=${encodeURIComponent(msg ?? '')}`;

  async function fetchLocale(loc) {
    if (LOCALES) return LOCALES[loc];
    const res = await fetch(`locales/${loc}.json`);
    if (!res.ok) throw new Error('locale fetch failed');
    return res.json();
  }

  function apply(data) {
    document.documentElement.lang = active;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const value = get(data, el.dataset.i18n);
      if (typeof value !== 'string') return;
      const attr = el.dataset.i18nAttr;
      if (attr) el.setAttribute(attr, value);
      else el.textContent = value;
    });

    const href = whatsappLink(data?.whatsappMessage);
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
    let stored; try { stored = localStorage.getItem(STORE); } catch {}
    if (stored === 'it' || stored === 'en') return stored;
    const lang = (navigator.language || 'it').slice(0, 2).toLowerCase();
    return lang === 'en' ? 'en' : 'it';
  }

  function bindHeader() {
    const header = document.getElementById('header');
    if (!header) return;
    const sync = () => header.classList.toggle('scrolled', scrollY > 60);
    addEventListener('scroll', sync, { passive: true });
    sync();
  }

  function bindMobileNav() {
    const toggle = document.getElementById('nav-toggle');
    const menu   = document.getElementById('nav-menu');
    if (!toggle || !menu) return;
    const isOpen = () => !menu.classList.contains('hidden');
    const open   = () => { menu.classList.remove('hidden'); toggle.setAttribute('aria-expanded', 'true');  };
    const close  = () => { menu.classList.add('hidden');    toggle.setAttribute('aria-expanded', 'false'); };
    toggle.addEventListener('click', () => (isOpen() ? close() : open()));
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
    addEventListener('scroll', () => isOpen() && close(), { passive: true });
  }

  function bindLightbox() {
    const box = document.getElementById('lightbox');
    if (!box) return;
    const big      = box.querySelector('img');
    const stage    = box.querySelector('.lb-stage');
    const counter  = box.querySelector('.lb-counter');
    const btnPrev  = box.querySelector('.lb-prev');
    const btnNext  = box.querySelector('.lb-next');
    const btnClose = box.querySelector('.lb-close');

    let group = [];
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
        alt: im.alt,
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

    box.addEventListener('click', (e) => {
      if (e.target === box || e.target === stage) close();
    });
    btnClose.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    btnNext .addEventListener('click', (e) => { e.stopPropagation(); next();  });
    btnPrev .addEventListener('click', (e) => { e.stopPropagation(); prev();  });

    addEventListener('keydown', (e) => {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
    });

    // Mobile only: tap on the image advances. Desktop has dedicated arrows.
    const isCoarse = matchMedia('(hover: none) and (pointer: coarse)');
    big.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isCoarse.matches && group.length > 1) next();
    });

    let startX = 0, startY = 0, tracking = false;
    box.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX; startY = e.touches[0].clientY; tracking = true;
    }, { passive: true });
    box.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX, dy = t.clientY - startY;
      const threshold = Math.max(50, innerWidth * 0.15);
      if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) next(); else prev();
      }
    }, { passive: true });
  }

  // The hash points at the lead <p>, but we want the section title in view.
  function bindPrenotaScroll() {
    const contact = document.getElementById('contact');
    if (!contact) return;
    const go = () => {
      if (location.hash !== '#prenota') return;
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

  function init() {
    bindHeader();
    bindMobileNav();
    bindLocale();
    bindLightbox();
    bindPrenotaScroll();

    const initial = detect();
    const pre = document.documentElement.dataset.prerender;

    if (pre && pre === initial && LOCALES) {
      // Page is already pre-rendered in this locale; skip the DOM thrash.
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