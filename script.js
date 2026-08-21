(function () {
  var cfg = window.FUNNEL_CONFIG || {};

  /* ---------- Checkout ---------- */
  var checkoutLinks = Array.prototype.slice.call(document.querySelectorAll('[data-checkout]'));
  checkoutLinks.forEach(function (a) {
    if (cfg.checkoutUrl) {
      a.href = cfg.checkoutUrl;
      a.setAttribute('rel', 'noopener');
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        window.location.href = cfg.checkoutUrl;
      });
    } else {
      a.href = '#offer';
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        var lang = window.getCurrentLang ? window.getCurrentLang() : 'en';
        var msg = window.I18N && window.I18N[lang] && window.I18N[lang].checkoutAlert;
        alert(msg || 'Checkout not configured.\n\nOpen config.js and set "checkoutUrl" to your product link.');
      });
    }
  });

  /* ---------- Countdown (persiste entre reloads) ---------- */
  var KEY = 'bg3d_deadline';
  var hours = Number(cfg.countdownHours) || 24;
  var deadline = Number(localStorage.getItem(KEY));
  if (!deadline || deadline < Date.now()) {
    deadline = Date.now() + hours * 3600000;
    localStorage.setItem(KEY, deadline);
  }

  var hEl = document.getElementById('h');
  var mEl = document.getElementById('m');
  var sEl = document.getElementById('s');

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    var diff = Math.max(0, deadline - Date.now());
    if (hEl) hEl.textContent = pad(Math.floor(diff / 3600000));
    if (mEl) mEl.textContent = pad(Math.floor((diff % 3600000) / 60000));
    if (sEl) sEl.textContent = pad(Math.floor((diff % 60000) / 1000));
  }
  tick();
  setInterval(tick, 1000);

  /* ---------- FAQ ---------- */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    if (!q) return;
    q.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (i) {
        i.classList.remove('open');
      });
      if (!isOpen) item.classList.add('open');
    });
  });

  /* ---------- Rolagem suave ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      var id = a.getAttribute('href').slice(1);
      var target = id && document.getElementById(id);
      if (!target) return;
      ev.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ---------- Pixels (so carregam se configurados) ---------- */
  if (cfg.metaPixelId) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', cfg.metaPixelId);
    fbq('track', 'PageView');

    checkoutLinks.forEach(function (a) {
      a.addEventListener('click', function () { fbq('track', 'InitiateCheckout'); });
    });
  }

  /* ---------- Language switcher ---------- */
  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      window.setLang(btn.getAttribute('data-lang'));
    });
  });

  if (cfg.gtagId) {
    var g = document.createElement('script');
    g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + cfg.gtagId;
    document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', cfg.gtagId);
  }
})();
