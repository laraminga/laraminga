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
                    class="inline-flex items-center justify-center bg-sage hover:bg-sageDark text-white px-5 py-3 rounded-full font-medium transition">
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
    toggle.addEventListener('click', () => {
      menu.classList.toggle('hidden');
      toggle.setAttribute(
        'aria-expanded',
        menu.classList.contains('hidden') ? 'false' : 'true'
      );
    });
    
    menu.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => {
        menu.classList.add('hidden');
        toggle.setAttribute('aria-expanded', 'false');
      })
    );
  }

  function bindLocaleButtons() {
    document.querySelectorAll('[data-locale-btn]').forEach((btn) => {
      btn.addEventListener('click', () => setLocale(btn.dataset.localeBtn));
    });
  }

  function init() {
    bindHeader();
    bindMobileNav();
    bindLocaleButtons();
    setLocale(detectInitialLocale());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
