import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'analytics.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    step TEXT,
    payload TEXT,
    lang TEXT,
    device TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    lang TEXT,
    device TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    max_scroll INTEGER DEFAULT 0,
    reached_preview INTEGER DEFAULT 0,
    reached_offer INTEGER DEFAULT 0,
    reached_checkout INTEGER DEFAULT 0,
    checkout_at INTEGER,
    current_section TEXT,
    page_views INTEGER DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
  CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
  CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen);
`);

const insertEvent = db.prepare(`
  INSERT INTO events (session_id, event_type, step, payload, lang, device, referrer, utm_source, utm_medium, utm_campaign, created_at)
  VALUES (@session_id, @event_type, @step, @payload, @lang, @device, @referrer, @utm_source, @utm_medium, @utm_campaign, @created_at)
`);

const upsertSession = db.prepare(`
  INSERT INTO sessions (
    session_id, first_seen, last_seen, lang, device, referrer,
    utm_source, utm_medium, utm_campaign, max_scroll,
    reached_preview, reached_offer, reached_checkout, checkout_at,
    current_section, page_views
  ) VALUES (
    @session_id, @first_seen, @last_seen, @lang, @device, @referrer,
    @utm_source, @utm_medium, @utm_campaign, @max_scroll,
    @reached_preview, @reached_offer, @reached_checkout, @checkout_at,
    @current_section, @page_views
  )
  ON CONFLICT(session_id) DO UPDATE SET
    last_seen = excluded.last_seen,
    lang = COALESCE(excluded.lang, sessions.lang),
    device = COALESCE(excluded.device, sessions.device),
    max_scroll = MAX(sessions.max_scroll, excluded.max_scroll),
    reached_preview = MAX(sessions.reached_preview, excluded.reached_preview),
    reached_offer = MAX(sessions.reached_offer, excluded.reached_offer),
    reached_checkout = MAX(sessions.reached_checkout, excluded.reached_checkout),
    checkout_at = COALESCE(sessions.checkout_at, excluded.checkout_at),
    current_section = COALESCE(excluded.current_section, sessions.current_section),
    page_views = sessions.page_views + excluded.page_views
`);

export function saveEvent(body) {
  const now = Date.now();
  const sessionId = body.session_id;
  if (!sessionId) return;

  const meta = body.meta || {};
  const payload = body.payload ? JSON.stringify(body.payload) : null;

  insertEvent.run({
    session_id: sessionId,
    event_type: body.event_type,
    step: body.step || null,
    payload,
    lang: meta.lang || null,
    device: meta.device || null,
    referrer: meta.referrer || null,
    utm_source: meta.utm_source || null,
    utm_medium: meta.utm_medium || null,
    utm_campaign: meta.utm_campaign || null,
    created_at: now
  });

  const existing = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId);
  const scroll = Number(body.payload?.scroll) || 0;
  const section = body.payload?.section || body.step || existing?.current_section || 'landing';

  const flags = {
    reached_preview: body.step === 'preview' || body.event_type === 'section_view' && body.step === 'preview' ? 1 : 0,
    reached_offer: body.step === 'offer' || body.event_type === 'section_view' && body.step === 'offer' ? 1 : 0,
    reached_checkout: body.event_type === 'checkout_click' ? 1 : 0,
    checkout_at: body.event_type === 'checkout_click' ? now : null
  };

  upsertSession.run({
    session_id: sessionId,
    first_seen: existing?.first_seen || now,
    last_seen: now,
    lang: meta.lang || existing?.lang || null,
    device: meta.device || existing?.device || null,
    referrer: meta.referrer || existing?.referrer || null,
    utm_source: meta.utm_source || existing?.utm_source || null,
    utm_medium: meta.utm_medium || existing?.utm_medium || null,
    utm_campaign: meta.utm_campaign || existing?.utm_campaign || null,
    max_scroll: Math.max(existing?.max_scroll || 0, scroll),
    reached_preview: Math.max(existing?.reached_preview || 0, flags.reached_preview),
    reached_offer: Math.max(existing?.reached_offer || 0, flags.reached_offer),
    reached_checkout: Math.max(existing?.reached_checkout || 0, flags.reached_checkout),
    checkout_at: existing?.checkout_at || flags.checkout_at,
    current_section: section,
    page_views: body.event_type === 'page_view' ? 1 : 0
  });
}

export function periodToMs(period) {
  const map = {
    today: () => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    },
    '1h': () => Date.now() - 3600000,
    '24h': () => Date.now() - 86400000,
    '7d': () => Date.now() - 7 * 86400000,
    '30d': () => Date.now() - 30 * 86400000,
    all: () => 0
  };
  return (map[period] || map['24h'])();
}

export function getOverview(since) {
  const sessions = db.prepare(`
    SELECT COUNT(*) AS c FROM sessions WHERE first_seen >= ?
  `).get(since).c;

  const live = db.prepare(`
    SELECT COUNT(*) AS c FROM sessions WHERE last_seen >= ?
  `).get(Date.now() - 180000).c;

  const checkouts = db.prepare(`
    SELECT COUNT(*) AS c FROM sessions WHERE checkout_at >= ?
  `).get(since).c;

  const preview = db.prepare(`
    SELECT COUNT(*) AS c FROM sessions WHERE first_seen >= ? AND reached_preview = 1
  `).get(since).c;

  const offer = db.prepare(`
    SELECT COUNT(*) AS c FROM sessions WHERE first_seen >= ? AND reached_offer = 1
  `).get(since).c;

  const carts = db.prepare(`
    SELECT COUNT(*) AS c FROM sessions WHERE checkout_at >= ? AND reached_checkout = 1
  `).get(since).c;

  const conversion = sessions ? ((checkouts / sessions) * 100).toFixed(1) : '0.0';

  return { sessions, live, checkouts, preview, offer, carts, conversion };
}

export function getFunnel(since) {
  const total = db.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE first_seen >= ?`).get(since).c || 1;
  const steps = [
    { key: 'landing', label: 'Visita (Landing)', col: 'session_id' },
    { key: 'engaged', label: 'Engajamento (25%+ scroll)', col: 'max_scroll >= 25' },
    { key: 'preview', label: 'Preview visto', col: 'reached_preview = 1' },
    { key: 'offer', label: 'Oferta vista', col: 'reached_offer = 1' },
    { key: 'checkout', label: 'Clique no checkout', col: 'reached_checkout = 1' }
  ];

  return steps.map(function (step) {
    let count;
    if (step.key === 'landing') {
      count = total;
    } else if (step.key === 'engaged') {
      count = db.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE first_seen >= ? AND max_scroll >= 25`).get(since).c;
    } else if (step.key === 'preview') {
      count = db.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE first_seen >= ? AND reached_preview = 1`).get(since).c;
    } else if (step.key === 'offer') {
      count = db.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE first_seen >= ? AND reached_offer = 1`).get(since).c;
    } else {
      count = db.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE first_seen >= ? AND reached_checkout = 1`).get(since).c;
    }
    return {
      key: step.key,
      label: step.label,
      count,
      rate: ((count / total) * 100).toFixed(1)
    };
  });
}

export function getTimeline(since, bucketMs) {
  const rows = db.prepare(`
    SELECT
      (created_at / ?) * ? AS bucket,
      event_type,
      COUNT(*) AS c
    FROM events
    WHERE created_at >= ?
    GROUP BY bucket, event_type
    ORDER BY bucket ASC
  `).all(bucketMs, bucketMs, since);

  return rows;
}

export function getLiveSessions() {
  return db.prepare(`
    SELECT session_id, lang, device, referrer, current_section, max_scroll,
           reached_preview, reached_offer, reached_checkout, first_seen, last_seen, checkout_at
    FROM sessions
    WHERE last_seen >= ?
    ORDER BY last_seen DESC
    LIMIT 50
  `).all(Date.now() - 300000);
}

export function getCarts(since) {
  return db.prepare(`
    SELECT session_id, lang, device, referrer, current_section, checkout_at, last_seen, utm_source, utm_campaign
    FROM sessions
    WHERE checkout_at >= ? AND reached_checkout = 1
    ORDER BY checkout_at DESC
    LIMIT 100
  `).all(since);
}

export function getBreakdown(since) {
  const langs = db.prepare(`
    SELECT lang, COUNT(*) AS c FROM sessions WHERE first_seen >= ? AND lang IS NOT NULL GROUP BY lang
  `).all(since);
  const devices = db.prepare(`
    SELECT device, COUNT(*) AS c FROM sessions WHERE first_seen >= ? AND device IS NOT NULL GROUP BY device
  `).all(since);
  const sources = db.prepare(`
    SELECT COALESCE(utm_source, 'direct') AS source, COUNT(*) AS c
    FROM sessions WHERE first_seen >= ? GROUP BY source ORDER BY c DESC LIMIT 10
  `).all(since);
  return { langs, devices, sources };
}

export function getRecentEvents(limit) {
  return db.prepare(`
    SELECT session_id, event_type, step, lang, device, created_at
    FROM events ORDER BY created_at DESC LIMIT ?
  `).all(limit || 30);
}

export { db };
