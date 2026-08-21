(function () {
  var TOKEN_KEY = 'bg3d_admin_token';
  var period = '24h';
  var view = 'dashboard';
  var charts = {};
  var pollTimer;

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

  function fmtTime(ts) {
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function fmtAgo(ts) {
    var s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return s + 's atrás';
    if (s < 3600) return Math.floor(s / 60) + 'min atrás';
    return Math.floor(s / 3600) + 'h atrás';
  }

  function shortId(id) {
    return id ? id.slice(-8) : '—';
  }

  function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    stopPoll();
  }

  function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    startPoll();
    refresh();
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
  }

  document.getElementById('login-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var password = document.getElementById('login-password').value;
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
      .catch(function (err) { alert(err.message || 'Falha no login'); });
  });

  document.getElementById('logout-btn').addEventListener('click', logout);

  document.querySelectorAll('.nav').forEach(function (btn) {
    btn.addEventListener('click', function () {
      view = btn.getAttribute('data-view');
      document.querySelectorAll('.nav').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach(function (v) { v.classList.add('hidden'); });
      document.getElementById('view-' + view).classList.remove('hidden');
      var titles = { dashboard: 'Dashboard', live: 'Live View', funnel: 'Funil', carts: 'Carrinhos' };
      document.getElementById('view-title').textContent = titles[view] || 'Admin';
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
        scales: type !== 'doughnut' && type !== 'bar' ? {
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' }, beginAtZero: true }
        } : {}
      }, options || {})
    });
  }

  function refresh() {
    var q = '?period=' + encodeURIComponent(period);

    if (view === 'dashboard' || view === 'funnel' || view === 'carts') {
      api('/api/admin/overview' + q).then(function (data) {
        document.getElementById('kpi-live').textContent = data.live;
        document.getElementById('kpi-sessions').textContent = data.sessions;
        document.getElementById('kpi-preview').textContent = data.preview;
        document.getElementById('kpi-offer').textContent = data.offer;
        document.getElementById('kpi-checkouts').textContent = data.checkouts;
        document.getElementById('kpi-conversion').textContent = data.conversion + '%';
        document.getElementById('kpi-carts').textContent = data.carts;
      });
    }

    if (view === 'dashboard') {
      api('/api/admin/funnel' + q).then(function (funnel) {
        renderFunnelRows(document.getElementById('funnel-mini'), funnel);
      });

      api('/api/admin/timeline' + q).then(function (rows) {
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

      api('/api/admin/breakdown' + q).then(function (data) {
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

      api('/api/admin/events?limit=30').then(function (events) {
        document.getElementById('events-body').innerHTML = events.map(function (e) {
          return '<tr><td>' + fmtTime(e.created_at) + '</td><td><code>' + shortId(e.session_id) + '</code></td><td>' + e.event_type + '</td><td>' + (e.step || '—') + '</td><td>' + (e.lang || '—') + '</td><td>' + (e.device || '—') + '</td></tr>';
        }).join('');
      });
    }

    if (view === 'live') {
      api('/api/admin/live').then(function (sessions) {
        document.getElementById('live-body').innerHTML = sessions.map(function (s) {
          var tags = [
            s.reached_preview ? 'preview' : null,
            s.reached_offer ? 'offer' : null,
            s.reached_checkout ? 'checkout' : null
          ].filter(Boolean).map(function (t) {
            return '<span class="tag on">' + t + '</span>';
          }).join('') || '<span class="tag">topo</span>';
          return '<tr><td><span class="status-dot"></span>online</td><td><code>' + shortId(s.session_id) + '</code></td><td>' + (s.current_section || '—') + '</td><td>' + (s.max_scroll || 0) + '%</td><td>' + (s.lang || '—') + '</td><td>' + (s.device || '—') + '</td><td><div class="funnel-tags">' + tags + '</div></td><td>' + fmtAgo(s.last_seen) + '</td></tr>';
        }).join('') || '<tr><td colspan="8">Nenhum visitante ativo</td></tr>';
      });
    }

    if (view === 'funnel') {
      api('/api/admin/funnel' + q).then(function (funnel) {
        renderFunnelRows(document.getElementById('funnel-detail'), funnel);
        upsertChart('chart-funnel', 'bar', funnel.map(function (f) { return f.label; }), [{
          label: 'Leads',
          data: funnel.map(function (f) { return f.count; }),
          backgroundColor: '#c99a4c'
        }], {
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
            y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } }
          }
        });
      });
    }

    if (view === 'carts') {
      api('/api/admin/carts' + q).then(function (carts) {
        document.getElementById('carts-body').innerHTML = carts.map(function (c) {
          return '<tr><td>' + fmtTime(c.checkout_at) + '</td><td><code>' + shortId(c.session_id) + '</code></td><td>' + (c.lang || '—') + '</td><td>' + (c.device || '—') + '</td><td>' + (c.utm_source || c.referrer || 'direct') + '</td><td>' + (c.utm_campaign || '—') + '</td><td>' + fmtAgo(c.last_seen) + '</td></tr>';
        }).join('') || '<tr><td colspan="7">Nenhum carrinho no período</td></tr>';
      });
    }
  }

  function startPoll() {
    stopPoll();
    pollTimer = setInterval(refresh, 10000);
  }

  function stopPoll() {
    if (pollTimer) clearInterval(pollTimer);
  }

  if (localStorage.getItem(TOKEN_KEY)) showApp();
  else showLogin();
})();
