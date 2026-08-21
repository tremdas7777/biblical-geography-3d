(function () {
  var cfg = window.FUNNEL_CONFIG || {};
  var sb = window.BG3DSupabaseAdmin;
  var useSupabase = sb && sb.isConfigured && sb.isConfigured();
  var TOKEN_KEY = 'bg3d_admin_token';
  var period = '24h';
  var view = 'dashboard';
  var charts = {};
  var pollTimer;
  var pollMs = 10000;

  var VIEW_TITLES = {
    dashboard: 'Dashboard',
    live: 'Live View',
    analytics: 'Análises',
    funnel: 'Funil',
    sessions: 'Sessões',
    carts: 'Carrinhos'
  };

  var EVENT_LABELS = {
    page_view: 'Visita',
    scroll_depth: 'Scroll',
    section_view: 'Seção vista',
    checkout_click: 'Checkout',
    cta_click: 'CTA',
    language_change: 'Idioma',
    heartbeat: 'Heartbeat'
  };

  function api(path) {
    var token = localStorage.getItem(TOKEN_KEY);
    return fetch(path, {
      headers: { Authorization: 'Bearer ' + token }
    }).then(function (r) {
      if (r.status === 401) {
        logout();
        throw new Error('Unauthorized');
      }
      return r.json();
    });
  }

  function dataOverview(p) { return useSupabase ? sb.overview(p) : api('/api/admin/overview?period=' + encodeURIComponent(p)); }
  function dataFunnel(p) { return useSupabase ? sb.funnel(p) : api('/api/admin/funnel?period=' + encodeURIComponent(p)); }
  function dataTimeline(p) { return useSupabase ? sb.timeline(p) : api('/api/admin/timeline?period=' + encodeURIComponent(p)); }
  function dataBreakdown(p) { return useSupabase ? sb.breakdown(p) : api('/api/admin/breakdown?period=' + encodeURIComponent(p)); }
  function dataLive() { return useSupabase ? sb.live() : api('/api/admin/live').then(function (d) { return { sessions: d.sessions || d, stats: d.stats || {} }; }); }
  function dataAnalytics(p) { return useSupabase ? sb.analytics(p) : api('/api/admin/analytics?period=' + encodeURIComponent(p)); }
  function dataSessions(p) { return useSupabase ? sb.sessions(p) : api('/api/admin/sessions?period=' + encodeURIComponent(p)); }
  function dataCarts(p) { return useSupabase ? sb.carts(p) : api('/api/admin/carts?period=' + encodeURIComponent(p)); }
  function dataEvents(limit) { return useSupabase ? sb.recentEvents(limit) : api('/api/admin/events?limit=' + limit); }

  function fmtTime(ts) {
    var n = typeof ts === 'string' ? new Date(ts).getTime() : ts;
    return new Date(n).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function fmtAgo(ts) {
    var t = typeof ts === 'string' ? new Date(ts).getTime() : ts;
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return s + 's atrás';
    if (s < 3600) return Math.floor(s / 60) + 'min atrás';
    return Math.floor(s / 3600) + 'h atrás';
  }

  function shortId(id) {
    return id ? id.slice(-8) : '—';
  }

  function yesNo(v) {
    return v ? '<span class="tag on">sim</span>' : '<span class="tag">—</span>';
  }

  function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    stopPoll();
  }

  function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    setPollInterval();
    refresh();
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    if (useSupabase && sb.logout) sb.logout();
    showLogin();
  }

  function showSetupHint() {
    var el = document.getElementById('setup-hint');
    var emailEl = document.getElementById('setup-email');
    if (el && !useSupabase && location.hostname !== 'localhost') el.classList.remove('hidden');
    if (emailEl && cfg.adminEmail) emailEl.textContent = cfg.adminEmail;
  }

  document.getElementById('login-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var password = document.getElementById('login-password').value;

    if (useSupabase) {
      var email = cfg.adminEmail || 'admin@thebiblicalgeography.com';
      sb.login(email, password)
        .then(function () { showApp(); })
        .catch(function (err) { alert(err.message || 'Senha incorreta'); });
      return;
    }

    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.data.error || 'Erro');
        localStorage.setItem(TOKEN_KEY, res.data.token);
        showApp();
      })
      .catch(function (err) { alert(err.message || 'Falha no login — use Supabase (Lovable) ou npm start (local)'); });
  });

  document.getElementById('logout-btn').addEventListener('click', logout);

  document.querySelectorAll('.nav').forEach(function (btn) {
    btn.addEventListener('click', function () {
      view = btn.getAttribute('data-view');
      document.querySelectorAll('.nav').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach(function (v) { v.classList.add('hidden'); });
      document.getElementById('view-' + view).classList.remove('hidden');
      document.getElementById('view-title').textContent = VIEW_TITLES[view] || 'Admin';
      updatePeriodVisibility();
      setPollInterval();
      refresh();
    });
  });

  document.getElementById('period-tabs').addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-period]');
    if (!btn) return;
    period = btn.getAttribute('data-period');
    document.querySelectorAll('#period-tabs button').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    refresh();
  });

  function updatePeriodVisibility() {
    var tabs = document.getElementById('period-tabs');
    var sub = document.getElementById('view-sub');
    if (view === 'live') {
      tabs.classList.add('hidden');
      sub.textContent = 'Tempo real · atualiza a cada 5s';
    } else {
      tabs.classList.remove('hidden');
      sub.textContent = 'Período: ' + periodLabel(period) + ' · atualiza a cada 10s';
    }
  }

  function periodLabel(p) {
    var map = { '1h': '1 hora', today: 'Hoje', '24h': '24 horas', '7d': '7 dias', '30d': '30 dias', all: 'Tudo' };
    return map[p] || p;
  }

  function setPollInterval() {
    pollMs = view === 'live' ? 5000 : 10000;
    startPoll();
  }

  function renderFunnelRows(container, funnel, maxCount) {
    container.innerHTML = '';
    maxCount = maxCount || (funnel[0]?.count || 1);
    funnel.forEach(function (step) {
      var pct = maxCount ? (step.count / maxCount) * 100 : 0;
      var row = document.createElement('div');
      row.className = 'funnel-row';
      row.innerHTML =
        '<span>' + step.label + '</span>' +
        '<div class="funnel-bar-wrap"><div class="funnel-bar" style="width:' + pct + '%"></div></div>' +
        '<strong>' + step.count + '</strong>' +
        '<span class="funnel-rate">' + step.rate + '%</span>';
      container.appendChild(row);
    });
  }

  function upsertChart(id, type, labels, datasets, options) {
    var canvas = document.getElementById(id);
    if (!canvas) return;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(canvas, {
      type: type,
      data: { labels: labels, datasets: datasets },
      options: Object.assign({
        responsive: true,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: type !== 'doughnut' && type !== 'bar' && type !== 'pie' ? {
          x: { ticks: { color: '#94a3b8', maxRotation: 45 }, grid: { color: '#1e293b' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' }, beginAtZero: true }
        } : (type === 'bar' ? {
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' }, beginAtZero: true },
          y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } }
        } : {})
      }, options || {})
    });
  }

  function refreshOverview() {
    var q = '?period=' + encodeURIComponent(period);
    return dataOverview(period).then(function (data) {
      document.getElementById('kpi-live').textContent = data.live;
      document.getElementById('kpi-sessions').textContent = data.sessions;
      document.getElementById('kpi-engaged').textContent = data.engaged + ' (' + data.engagementRate + '%)';
      document.getElementById('kpi-preview').textContent = data.preview;
      document.getElementById('kpi-offer').textContent = data.offer;
      document.getElementById('kpi-checkouts').textContent = data.checkouts;
      document.getElementById('kpi-scroll').textContent = data.avgScroll + '%';
      document.getElementById('kpi-conversion').textContent = data.conversion + '%';
      document.getElementById('kpi-carts').textContent = data.carts;
      var badge = document.getElementById('live-badge');
      if (badge) {
        badge.textContent = data.live;
        badge.classList.toggle('on', data.live > 0);
      }
    });
  }

  function refreshDashboard() {
    var q = '?period=' + encodeURIComponent(period);

    refreshOverview();

    dataFunnel(period).then(function (funnel) {
      renderFunnelRows(document.getElementById('funnel-mini'), funnel);
    });

    dataTimeline(period).then(function (rows) {
      var buckets = {};
      rows.forEach(function (r) {
        if (!buckets[r.bucket]) buckets[r.bucket] = { page_view: 0, checkout_click: 0, section_view: 0 };
        if (r.event_type === 'page_view') buckets[r.bucket].page_view += r.c;
        if (r.event_type === 'checkout_click') buckets[r.bucket].checkout_click += r.c;
        if (r.event_type === 'section_view') buckets[r.bucket].section_view += r.c;
      });
      var keys = Object.keys(buckets).sort(function (a, b) { return a - b; });
      var labels = keys.map(function (k) { return fmtTime(Number(k)); });
      upsertChart('chart-timeline', 'line', labels, [
        { label: 'Visitas', data: keys.map(function (k) { return buckets[k].page_view; }), borderColor: '#3b82f6', tension: 0.3 },
        { label: 'Seções', data: keys.map(function (k) { return buckets[k].section_view; }), borderColor: '#c99a4c', tension: 0.3 },
        { label: 'Checkouts', data: keys.map(function (k) { return buckets[k].checkout_click; }), borderColor: '#22c55e', tension: 0.3 }
      ]);
    });

    dataBreakdown(period).then(function (data) {
      upsertChart('chart-lang', 'doughnut', data.langs.map(function (l) { return l.lang || '?'; }), [{
        data: data.langs.map(function (l) { return l.c; }),
        backgroundColor: ['#c99a4c', '#3b82f6', '#22c55e', '#a855f7']
      }]);
      upsertChart('chart-device', 'doughnut', data.devices.map(function (d) { return d.device; }), [{
        data: data.devices.map(function (d) { return d.c; }),
        backgroundColor: ['#6366f1', '#14b8a6', '#f59e0b']
      }]);
      var sl = document.getElementById('sources-list');
      sl.innerHTML = data.sources.map(function (s) {
        return '<div class="source-row"><span>' + s.source + '</span><strong>' + s.c + '</strong></div>';
      }).join('') || '<p class="hint">Sem dados de origem</p>';
    });

    dataEvents(30).then(function (events) {
      document.getElementById('events-body').innerHTML = events.map(function (e) {
        return '<tr><td>' + fmtTime(e.created_at) + '</td><td><code>' + shortId(e.session_id) + '</code></td><td>' + (EVENT_LABELS[e.event_type] || e.event_type) + '</td><td>' + (e.step || '—') + '</td><td>' + (e.lang || '—') + '</td><td>' + (e.device || '—') + '</td></tr>';
      }).join('');
    });
  }

  function refreshLive() {
    dataLive().then(function (data) {
      var sessions = data.sessions || [];
      var stats = data.stats || {};

      document.getElementById('live-kpi-online').textContent = stats.online || 0;
      document.getElementById('live-kpi-offer').textContent = stats.onOffer || 0;
      document.getElementById('live-kpi-checkout').textContent = stats.onCheckout || 0;

      var badge = document.getElementById('live-badge');
      if (badge) {
        badge.textContent = stats.online || 0;
        badge.classList.toggle('on', (stats.online || 0) > 0);
      }
      document.getElementById('kpi-live').textContent = stats.online || 0;

      var sections = stats.bySection || [];
      upsertChart('chart-live-sections', 'doughnut',
        sections.map(function (s) { return s.section; }),
        [{
          data: sections.map(function (s) { return s.c; }),
          backgroundColor: ['#3b82f6', '#c99a4c', '#22c55e', '#a855f7', '#6366f1', '#14b8a6']
        }],
        { plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12 } } } }
      );

      document.getElementById('live-body').innerHTML = sessions.map(function (s) {
        var tags = [
          s.reached_preview ? 'preview' : null,
          s.reached_offer ? 'offer' : null,
          s.reached_checkout ? 'checkout' : null
        ].filter(Boolean).map(function (t) {
          return '<span class="tag on">' + t + '</span>';
        }).join('') || '<span class="tag">topo</span>';
        return '<tr><td><span class="status-dot"></span>online</td><td><code>' + shortId(s.session_id) + '</code></td><td>' + (s.current_section || '—') + '</td><td>' + (s.max_scroll || 0) + '%</td><td>' + (s.lang || '—') + '</td><td>' + (s.device || '—') + '</td><td><div class="funnel-tags">' + tags + '</div></td><td>' + fmtAgo(s.last_seen) + '</td></tr>';
      }).join('') || '<tr><td colspan="8">Nenhum visitante ativo no momento</td></tr>';
    });
  }

  function refreshAnalytics() {
    var q = '?period=' + encodeURIComponent(period);
    dataAnalytics(period).then(function (data) {
      var scroll = data.scroll || [];
      upsertChart('chart-scroll', 'bar',
        scroll.map(function (s) { return s.mark + '%'; }),
        [{
          label: 'Sessões',
          data: scroll.map(function (s) { return s.count; }),
          backgroundColor: '#c99a4c'
        }]
      );

      var events = data.events || [];
      upsertChart('chart-events', 'bar',
        events.map(function (e) { return EVENT_LABELS[e.event_type] || e.event_type; }),
        [{
          label: 'Total',
          data: events.map(function (e) { return e.c; }),
          backgroundColor: '#3b82f6'
        }],
        { indexAxis: 'y', plugins: { legend: { display: false } } }
      );

      var ctas = data.ctas || [];
      document.getElementById('cta-list').innerHTML = ctas.map(function (c) {
        return '<div class="source-row"><span>' + (c.cta || '—') + '</span><strong>' + c.c + '</strong></div>';
      }).join('') || '<p class="hint">Sem cliques em CTAs no período</p>';
    });
  }

  function refreshFunnel() {
    var q = '?period=' + encodeURIComponent(period);
    refreshOverview();
    dataFunnel(period).then(function (funnel) {
      renderFunnelRows(document.getElementById('funnel-detail'), funnel);
      upsertChart('chart-funnel', 'bar', funnel.map(function (f) { return f.label; }), [{
        label: 'Leads',
        data: funnel.map(function (f) { return f.count; }),
        backgroundColor: '#c99a4c'
      }], {
        indexAxis: 'y',
        plugins: { legend: { display: false } }
      });
    });
  }

  function refreshSessions() {
    var q = '?period=' + encodeURIComponent(period);
    dataSessions(period).then(function (sessions) {
      document.getElementById('sessions-body').innerHTML = sessions.map(function (s) {
        return '<tr><td>' + fmtTime(s.first_seen) + '</td><td><code>' + shortId(s.session_id) + '</code></td><td>' + (s.lang || '—') + '</td><td>' + (s.device || '—') + '</td><td>' + (s.max_scroll || 0) + '%</td><td>' + yesNo(s.reached_preview) + '</td><td>' + yesNo(s.reached_offer) + '</td><td>' + yesNo(s.reached_checkout) + '</td><td>' + (s.utm_source || s.referrer || 'direct') + '</td><td>' + fmtAgo(s.last_seen) + '</td></tr>';
      }).join('') || '<tr><td colspan="10">Nenhuma sessão no período</td></tr>';
    });
  }

  function refreshCarts() {
    var q = '?period=' + encodeURIComponent(period);
    refreshOverview();
    dataCarts(period).then(function (carts) {
      document.getElementById('carts-body').innerHTML = carts.map(function (c) {
        return '<tr><td>' + fmtTime(c.checkout_at) + '</td><td><code>' + shortId(c.session_id) + '</code></td><td>' + (c.lang || '—') + '</td><td>' + (c.device || '—') + '</td><td>' + (c.utm_source || c.referrer || 'direct') + '</td><td>' + (c.utm_campaign || '—') + '</td><td>' + fmtAgo(c.last_seen) + '</td></tr>';
      }).join('') || '<tr><td colspan="7">Nenhum carrinho no período</td></tr>';
    });
  }

  function refresh() {
    updatePeriodVisibility();
    if (view === 'dashboard') refreshDashboard();
    else if (view === 'live') refreshLive();
    else if (view === 'analytics') refreshAnalytics();
    else if (view === 'funnel') refreshFunnel();
    else if (view === 'sessions') refreshSessions();
    else if (view === 'carts') refreshCarts();

    if (view !== 'dashboard' && view !== 'live') {
      dataOverview(period).then(function (data) {
        var badge = document.getElementById('live-badge');
        if (badge) {
          badge.textContent = data.live;
          badge.classList.toggle('on', data.live > 0);
        }
      }).catch(function () {});
    }
  }

  function startPoll() {
    stopPoll();
    pollTimer = setInterval(refresh, pollMs);
  }

  function stopPoll() {
    if (pollTimer) clearInterval(pollTimer);
  }

  showSetupHint();

  if (useSupabase) {
    sb.getSession().then(function (session) {
      if (session) showApp();
      else showLogin();
    });
  } else if (localStorage.getItem(TOKEN_KEY)) {
    showApp();
  } else {
    showLogin();
  }
})();
