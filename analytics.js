(function () {
  var cfg = window.FUNNEL_CONFIG || {};
  var apiBase = cfg.analyticsApi;
  if (apiBase === false) return;
  if (!apiBase) apiBase = '';

  var SESSION_KEY = 'bg3d_sid';
  var sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  function deviceType() {
    var w = window.innerWidth;
    if (w < 520) return 'mobile';
    if (w < 900) return 'tablet';
    return 'desktop';
  }

  function utm() {
    var p = new URLSearchParams(window.location.search);
    return {
      utm_source: p.get('utm_source') || '',
      utm_medium: p.get('utm_medium') || '',
      utm_campaign: p.get('utm_campaign') || ''
    };
  }

  var utmData = utm();

  function meta() {
    return {
      lang: window.getCurrentLang ? window.getCurrentLang() : (document.documentElement.lang || 'es'),
      device: deviceType(),
      referrer: document.referrer || '',
      utm_source: utmData.utm_source,
      utm_medium: utmData.utm_medium,
      utm_campaign: utmData.utm_campaign
    };
  }

  function track(eventType, step, payload) {
    var body = {
      session_id: sessionId,
      event_type: eventType,
      step: step || null,
      payload: payload || null,
      meta: meta()
    };

    var url = apiBase + '/api/track';
    if (navigator.sendBeacon && eventType === 'heartbeat') {
      try {
        navigator.sendBeacon(url, new Blob([JSON.stringify(body)], { type: 'application/json' }));
        return;
      } catch (e) { /* fallback */ }
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true
    }).catch(function () { /* silent */ });
  }

  track('page_view', 'landing');

  var maxScroll = 0;
  var scrollMarks = { 25: false, 50: false, 75: false, 100: false };

  function onScroll() {
    var doc = document.documentElement;
    var scrollTop = window.scrollY || doc.scrollTop;
    var height = doc.scrollHeight - window.innerHeight;
    var pct = height > 0 ? Math.min(100, Math.round((scrollTop / height) * 100)) : 0;
    if (pct > maxScroll) maxScroll = pct;

    [25, 50, 75, 100].forEach(function (mark) {
      if (!scrollMarks[mark] && pct >= mark) {
        scrollMarks[mark] = true;
        track('scroll_depth', 'scroll_' + mark, { scroll: mark });
      }
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var sections = [
    { id: 'preview', step: 'preview' },
    { id: 'offer', step: 'offer' }
  ];

  if ('IntersectionObserver' in window) {
    var seen = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.35) return;
        var step = entry.target.getAttribute('data-funnel-step') || entry.target.id;
        if (seen[step]) return;
        seen[step] = true;
        track('section_view', step, { section: step, scroll: maxScroll });
      });
    }, { threshold: [0.35] });

    sections.forEach(function (s) {
      var el = document.getElementById(s.id);
      if (el) {
        el.setAttribute('data-funnel-step', s.step);
        observer.observe(el);
      }
    });

    document.querySelectorAll('.section').forEach(function (el) {
      if (!el.id && !el.getAttribute('data-funnel-step')) {
        el.setAttribute('data-funnel-step', el.querySelector('.eyebrow')?.textContent?.slice(0, 24) || 'section');
      }
    });
  }

  document.querySelectorAll('[data-checkout]').forEach(function (el) {
    el.addEventListener('click', function () {
      track('checkout_click', 'checkout', { section: 'offer', scroll: maxScroll, cart: true });
    });
  });

  document.querySelectorAll('a.btn, a.btn-outline').forEach(function (el) {
    if (el.hasAttribute('data-checkout')) return;
    el.addEventListener('click', function () {
      var href = el.getAttribute('href') || '';
      track('cta_click', href.indexOf('#') === 0 ? href.slice(1) : 'external', {
        label: el.textContent.trim().slice(0, 60),
        href: href
      });
    });
  });

  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      track('language_change', btn.getAttribute('data-lang'));
    });
  });

  setInterval(function () {
    track('heartbeat', getCurrentSection(), { scroll: maxScroll, section: getCurrentSection() });
  }, 30000);

  function getCurrentSection() {
    var best = 'landing';
    var bestTop = Infinity;
    document.querySelectorAll('section[id], header.hero').forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top >= -80 && rect.top < bestTop) {
        bestTop = rect.top;
        best = el.id || (el.classList.contains('hero') ? 'hero' : 'section');
      }
    });
    return best;
  }

  window.bg3dTrack = track;
})();
