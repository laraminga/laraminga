(() => {
  const PHONE = '393471457329';
  const EMAIL = 'vale.sfra@hotmail.it';
  const STORAGE_KEY = 'la-raminga-lang';
  const SUPPORTED = ['it', 'en'];

  const SERVICE_IMAGES = [
    { src: 'terrace-table-blue-plates-mountains.jpeg' },
    { src: 'savory-cheesecake-plated-above-sauce.jpeg', position: 'center 25%' },
    { src: 'bowls-pesto-purple-cream-condiments.jpeg' },
  ];

  const state = { locale: null };

  const getNested = (obj, path) =>
    path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

  const escapeHtml = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );

  const waLink = (msg) =>
    `https://wa.me/${PHONE}?text=${encodeURIComponent(msg ?? '')}`;

  async function loadLocale(locale) {
    const res = await fetch(`locales/${locale}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load locale ${locale}`);
    return res.json();
  }

  function applyText(data) {
    document.documentElement.lang = state.locale;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const attr = el.getAttribute('data-i18n-attr');
      const val = getNested(data, key);
      if (typeof val !== 'string') return;
      if (attr) el.setAttribute(attr, val);
      else el.textContent = val;
    });

    const services = document.getElementById('services-list');
    if (services && Array.isArray(data?.services?.items)) {
      const msg = data.whatsappMessage ?? '';
      services.innerHTML = data.services.items
        .map((s, i) => {
          const cfg = SERVICE_IMAGES[i] || SERVICE_IMAGES[0];
          const src = cfg.src;
          const webp = src.replace(/\.jpe?g$/i, '.webp');
          const posStyle = cfg.position ? ` style="object-position: ${cfg.position}"` : '';
          const detailsHtml = (s?.details ?? [])
            .map((d) => `<li>${escapeHtml(d)}</li>`)
            .join('');
          return `
            <article class="flex flex-col bg-white rounded-2xl overflow-hidden border border-ochre/20 shadow-sm">
              <div class="aspect-[5/3] overflow-hidden bg-cream">
                <picture>
                  <source srcset="img/${webp}" type="image/webp" />
                  <img src="img/${src}" alt="" loading="lazy" decoding="async" class="w-full h-full object-cover"${posStyle} />
                </picture>
              </div>
              <div class="p-6 md:p-7 flex-1 flex flex-col">
                <h3 class="text-2xl font-semibold">${escapeHtml(s?.title)}</h3>
                <p class="mt-3 leading-relaxed">${escapeHtml(s?.body)}</p>
                <ul class="bullet-list mt-5 space-y-1.5 list-none">${detailsHtml}</ul>
                <div class="mt-auto pt-5">
                  <a href="${waLink(msg)}" target="_blank" rel="noopener"
                    class="inline-flex items-center justify-center bg-brick hover:bg-terra text-white px-5 py-3 rounded-full font-medium transition">
                    ${escapeHtml(s?.cta)}
                  </a>
                </div>
              </div>
            </article>`;
        })
        .join('');
    }

    const msg = data?.whatsappMessage ?? '';
    const href = waLink(msg);
    document.querySelectorAll('[data-whatsapp]').forEach((a) => {
      a.setAttribute('href', href);
    });

    const emailLink = document.getElementById('email-link');
    if (emailLink) emailLink.setAttribute('href', `mailto:${EMAIL}`);
  }

  async function setLocale(locale) {
    if (!SUPPORTED.includes(locale)) locale = 'it';
    if (state.locale === locale) return;
    state.locale = locale;
    try {
      const data = await loadLocale(locale);
      applyText(data);
      try { localStorage.setItem(STORAGE_KEY, locale); } catch (_) {}
      document.querySelectorAll('[data-locale-btn]').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.localeBtn === locale);
        b.setAttribute('aria-pressed', String(b.dataset.localeBtn === locale));
      });
    } catch (err) {
      console.error(err);
    }
  }

  function detectInitialLocale() {
    let stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (_) {}
    if (stored && SUPPORTED.includes(stored)) return stored;
    const nav = (navigator.language || 'it').slice(0, 2).toLowerCase();
    return SUPPORTED.includes(nav) ? nav : 'it';
  }

  function bindHeader() {
    const header = document.getElementById('header');
    if (!header) return;
    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function bindMobileNav() {
    const toggle = document.getElementById('nav-toggle');
    const menu = document.getElementById('nav-menu');
    if (!toggle || !menu) return;

    const isOpen = () => !menu.classList.contains('hidden');
    const close = () => {
      menu.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
    };
    const open = () => {
      menu.classList.remove('hidden');
      toggle.setAttribute('aria-expanded', 'true');
    };

    toggle.addEventListener('click', () => (isOpen() ? close() : open()));

    menu.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', close)
    );

    // close the menu as soon as the user starts scrolling
    window.addEventListener(
      'scroll',
      () => { if (isOpen()) close(); },
      { passive: true }
    );
  }

  function bindLocaleButtons() {
    document.querySelectorAll('[data-locale-btn]').forEach((btn) => {
      btn.addEventListener('click', () => setLocale(btn.dataset.localeBtn));
    });
  }

  /* === decorative herb / fruit / flower doodles ============================
     Scatters a few Lucide-icon SVGs (defined in <defs> at the top of <body>)
     at random positions inside each main section, using zone slots so they
     stay near the edges and don't crowd the centre content. */
  const DECOR_ICONS = [
    'd-leaf', 'd-flower', 'd-sprout', 'd-wheat',
    'd-cherry', 'd-grape', 'd-citrus',
  ];
  const DECOR_COLORS = [
    'text-sage', 'text-sageDark', 'text-brick',
    'text-terra', 'text-ochre', 'text-sageDeep',
  ];
  const DECOR_SECTIONS = ['about', 'cuisine', 'garden', 'services', 'gallery'];
  const DECOR_PER_SECTION = 4;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const rand = (min, max) => Math.random() * (max - min) + min;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* Six "edge zones" — one near each corner plus two on the long mid-sides.
     Each call returns absolute placement values that keep the doodle out of
     the section's central 60% (where the text and images sit). */
  function pickZone() {
    const zones = [
      { top:  rand(3, 14)  + '%', left:  rand(2, 10) + '%' },  // top-left
      { top:  rand(3, 14)  + '%', right: rand(2, 10) + '%' },  // top-right
      { bottom: rand(4, 16) + '%', left:  rand(2, 10) + '%' }, // bottom-left
      { bottom: rand(4, 16) + '%', right: rand(2, 10) + '%' }, // bottom-right
      { top:  rand(38, 60) + '%', left:  rand(1, 6)  + '%' },  // mid-left
      { top:  rand(38, 60) + '%', right: rand(1, 6)  + '%' },  // mid-right
    ];
    return pick(zones);
  }

  function makeDecor() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'decor ' + pick(DECOR_COLORS));
    svg.setAttribute('aria-hidden', 'true');
    const size = Math.round(rand(36, 58));
    const rot = Math.round(rand(-22, 22));
    const opacity = rand(0.35, 0.55).toFixed(2);
    const zone = pickZone();
    const zoneStyle = Object.entries(zone)
      .map(([k, v]) => `${k}:${v}`)
      .join(';');
    svg.setAttribute(
      'style',
      `${zoneStyle};width:${size}px;height:${size}px;transform:rotate(${rot}deg);opacity:${opacity}`
    );
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#' + pick(DECOR_ICONS));
    svg.appendChild(use);
    return svg;
  }

  function scatterDecor() {
    DECOR_SECTIONS.forEach((id) => {
      const section = document.getElementById(id);
      if (!section) return;
      // shuffle zone usage per section so corners aren't always picked first
      for (let i = 0; i < DECOR_PER_SECTION; i++) {
        section.insertBefore(makeDecor(), section.firstChild);
      }
    });
  }

  function init() {
    bindHeader();
    bindMobileNav();
    bindLocaleButtons();
    // scatterDecor();  // disabled — re-enable to scatter herb / fruit doodles
    setLocale(detectInitialLocale());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
