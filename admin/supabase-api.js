(function (global) {
  var cfg = global.FUNNEL_CONFIG || {};
  var client = null;

  function init() {
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
    if (!global.supabase || !global.supabase.createClient) return null;
    if (!client) client = global.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    return client;
  }

  function periodToMs(period) {
    var now = Date.now();
    if (period === 'today') {
      var d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    var map = { '1h': 3600000, '24h': 86400000, '7d': 7 * 86400000, '30d': 30 * 86400000, all: 0 };
    return map[period] !== undefined ? (period === 'all' ? 0 : now - map[period]) : now - 86400000;
  }

  function sinceIso(period) {
    return new Date(periodToMs(period)).toISOString();
  }

  function login(email, password) {
    var sb = init();
    if (!sb) return Promise.reject(new Error('Supabase não configurado em config.js'));
    return sb.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error) throw res.error;
      return res.data.session;
    });
  }

  function logout() {
    var sb = init();
    if (sb) return sb.auth.signOut();
    return Promise.resolve();
  }

  function getSession() {
    var sb = init();
    if (!sb) return null;
    return sb.auth.getSession().then(function (r) { return r.data.session; });
  }

  function fetchSessionsSince(period) {
    var sb = init();
    var q = sb.from('bg3d_sessions').select('*').order('last_seen', { ascending: false });
    if (period !== 'all') q = q.gte('first_seen', sinceIso(period));
    return q.limit(500);
  }

  function fetchEventsSince(period, limit) {
    var sb = init();
    var q = sb.from('bg3d_events').select('*').order('created_at', { ascending: false });
    if (period !== 'all') q = q.gte('created_at', sinceIso(period));
    return q.limit(limit || 500);
  }

  function overview(period) {
    var liveSince = new Date(Date.now() - 300000).toISOString();
    return fetchSessionsSince(period).then(function (res) {
      if (res.error) throw res.error;
      var rows = res.data || [];
      var sessions = rows.length;
      var live = rows.filter(function (s) { return s.last_seen >= liveSince; }).length;
      var checkouts = rows.filter(function (s) { return s.reached_checkout; }).length;
      var preview = rows.filter(function (s) { return s.reached_preview; }).length;
      var offer = rows.filter(function (s) { return s.reached_offer; }).length;
      var engaged = rows.filter(function (s) { return (s.max_scroll || 0) >= 25; }).length;
      var scrollSum = rows.reduce(function (a, s) { return a + (s.max_scroll || 0); }, 0);
      return {
        sessions: sessions,
        live: live,
        checkouts: checkouts,
        preview: preview,
        offer: offer,
        carts: checkouts,
        conversion: sessions ? ((checkouts / sessions) * 100).toFixed(1) : '0.0',
        engaged: engaged,
        engagementRate: sessions ? ((engaged / sessions) * 100).toFixed(1) : '0.0',
        avgScroll: sessions ? (scrollSum / sessions).toFixed(1) : '0'
      };
    });
  }

  function funnel(period) {
    return fetchSessionsSince(period).then(function (res) {
      if (res.error) throw res.error;
      var rows = res.data || [];
      var total = rows.length || 1;
      var steps = [
        { key: 'landing', label: 'Visita (Landing)', test: function () { return true; } },
        { key: 'engaged', label: 'Engajamento (25%+ scroll)', test: function (s) { return (s.max_scroll || 0) >= 25; } },
        { key: 'preview', label: 'Preview visto', test: function (s) { return s.reached_preview; } },
        { key: 'offer', label: 'Oferta vista', test: function (s) { return s.reached_offer; } },
        { key: 'checkout', label: 'Clique no checkout', test: function (s) { return s.reached_checkout; } }
      ];
      return steps.map(function (step) {
        var count = rows.filter(step.test).length;
        return {
          key: step.key,
          label: step.label,
          count: count,
          rate: ((count / total) * 100).toFixed(1)
        };
      });
    });
  }

  function live() {
    var liveSince = new Date(Date.now() - 300000).toISOString();
    return fetchSessionsSince('all').then(function (res) {
      if (res.error) throw res.error;
      var rows = (res.data || []).filter(function (s) { return s.last_seen >= liveSince; });
      var bySection = {};
      rows.forEach(function (s) {
        var sec = s.current_section || 'landing';
        bySection[sec] = (bySection[sec] || 0) + 1;
      });
      return {
        sessions: rows.sort(function (a, b) { return new Date(b.last_seen) - new Date(a.last_seen); }).slice(0, 50),
        stats: {
          online: rows.length,
          onOffer: rows.filter(function (s) { return s.reached_offer; }).length,
          onCheckout: rows.filter(function (s) { return s.reached_checkout; }).length,
          bySection: Object.keys(bySection).map(function (k) { return { section: k, c: bySection[k] }; })
        }
      };
    });
  }

  function carts(period) {
    return fetchSessionsSince(period).then(function (res) {
      if (res.error) throw res.error;
      return (res.data || [])
        .filter(function (s) { return s.reached_checkout && s.checkout_at; })
        .sort(function (a, b) { return new Date(b.checkout_at) - new Date(a.checkout_at); })
        .slice(0, 100);
    });
  }

  function sessions(period) {
    return fetchSessionsSince(period).then(function (res) {
      if (res.error) throw res.error;
      return (res.data || []).slice(0, 100);
    });
  }

  function breakdown(period) {
    return fetchSessionsSince(period).then(function (res) {
      if (res.error) throw res.error;
      var rows = res.data || [];
      var langs = {}, devices = {}, sources = {};
      rows.forEach(function (s) {
        if (s.lang) langs[s.lang] = (langs[s.lang] || 0) + 1;
        if (s.device) devices[s.device] = (devices[s.device] || 0) + 1;
        var src = s.utm_source || 'direct';
        sources[src] = (sources[src] || 0) + 1;
      });
      return {
        langs: Object.keys(langs).map(function (k) { return { lang: k, c: langs[k] }; }),
        devices: Object.keys(devices).map(function (k) { return { device: k, c: devices[k] }; }),
        sources: Object.keys(sources).map(function (k) { return { source: k, c: sources[k] }; }).sort(function (a, b) { return b.c - a.c; }).slice(0, 10)
      };
    });
  }

  function timeline(period) {
    return fetchEventsSince(period, 2000).then(function (res) {
      if (res.error) throw res.error;
      var bucketMs = period === '1h' ? 300000 : (period === '24h' || period === 'today' ? 3600000 : 86400000);
      var buckets = {};
      (res.data || []).forEach(function (e) {
        var t = new Date(e.created_at).getTime();
        var bucket = Math.floor(t / bucketMs) * bucketMs;
        var key = String(bucket);
        if (!buckets[key]) buckets[key] = {};
        buckets[key][e.event_type] = (buckets[key][e.event_type] || 0) + 1;
      });
      return Object.keys(buckets).sort(function (a, b) { return Number(a) - Number(b); }).flatMap(function (k) {
        return Object.keys(buckets[k]).map(function (type) {
          return { bucket: Number(k), event_type: type, c: buckets[k][type] };
        });
      });
    });
  }

  function analytics(period) {
    return Promise.all([fetchEventsSince(period, 3000), fetchSessionsSince(period)]).then(function (results) {
      var evRes = results[0], sessRes = results[1];
      if (evRes.error) throw evRes.error;
      var events = evRes.data || [];
      var sessions = sessRes.data || [];
      var eventCounts = {};
      events.forEach(function (e) {
        eventCounts[e.event_type] = (eventCounts[e.event_type] || 0) + 1;
      });
      var marks = [25, 50, 75, 100];
      var scroll = marks.map(function (mark) {
        return {
          mark: mark,
          count: sessions.filter(function (s) { return (s.max_scroll || 0) >= mark; }).length
        };
      });
      var ctaMap = {};
      events.filter(function (e) { return e.event_type === 'cta_click'; }).forEach(function (e) {
        var k = e.step || '?';
        ctaMap[k] = (ctaMap[k] || 0) + 1;
      });
      var ctas = Object.keys(ctaMap).map(function (k) { return { cta: k, c: ctaMap[k] }; }).sort(function (a, b) { return b.c - a.c; });
      return {
        events: Object.keys(eventCounts).map(function (k) { return { event_type: k, c: eventCounts[k] }; }),
        scroll: scroll,
        ctas: ctas
      };
    });
  }

  function recentEvents(limit) {
    return fetchEventsSince('all', limit || 30).then(function (res) {
      if (res.error) throw res.error;
      return (res.data || []).map(function (e) {
        return {
          session_id: e.session_id,
          event_type: e.event_type,
          step: e.step,
          lang: e.lang,
          device: e.device,
          created_at: new Date(e.created_at).getTime()
        };
      });
    });
  }

  global.BG3DSupabaseAdmin = {
    init: init,
    login: login,
    logout: logout,
    getSession: getSession,
    overview: overview,
    funnel: funnel,
    live: live,
    carts: carts,
    sessions: sessions,
    breakdown: breakdown,
    timeline: timeline,
    analytics: analytics,
    recentEvents: recentEvents,
    isConfigured: function () { return !!(cfg.supabaseUrl && cfg.supabaseAnonKey); }
  };
})(window);
