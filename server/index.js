import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  saveEvent,
  periodToMs,
  getOverview,
  getFunnel,
  getTimeline,
  getLiveSessions,
  getCarts,
  getBreakdown,
  getRecentEvents
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 8090;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const tokens = new Map();

function createToken() {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, Date.now() + 86400000 * 7);
  return token;
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const exp = tokens.get(token);
  if (!exp || exp < Date.now()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

const app = express();
app.use(express.json({ limit: '32kb' }));

app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.post('/api/track', function (req, res) {
  try {
    saveEvent(req.body || {});
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save event' });
  }
});

app.post('/api/admin/login', function (req, res) {
  const password = req.body?.password || '';
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Senha incorreta' });
  }
  res.json({ token: createToken() });
});

app.get('/api/admin/overview', auth, function (req, res) {
  const since = periodToMs(req.query.period || '24h');
  res.json(getOverview(since));
});

app.get('/api/admin/funnel', auth, function (req, res) {
  const since = periodToMs(req.query.period || '24h');
  res.json(getFunnel(since));
});

app.get('/api/admin/timeline', auth, function (req, res) {
  const period = req.query.period || '24h';
  const since = periodToMs(period);
  const bucketMs = period === '1h' ? 300000 : period === '24h' || period === 'today' ? 3600000 : 86400000;
  res.json(getTimeline(since, bucketMs));
});

app.get('/api/admin/live', auth, function (req, res) {
  res.json(getLiveSessions());
});

app.get('/api/admin/carts', auth, function (req, res) {
  const since = periodToMs(req.query.period || '24h');
  res.json(getCarts(since));
});

app.get('/api/admin/breakdown', auth, function (req, res) {
  const since = periodToMs(req.query.period || '24h');
  res.json(getBreakdown(since));
});

app.get('/api/admin/events', auth, function (req, res) {
  res.json(getRecentEvents(Number(req.query.limit) || 40));
});

app.use('/admin', express.static(path.join(root, 'admin')));
app.use(express.static(root));

app.get('*', function (req, res) {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  const index = path.join(root, 'index.html');
  if (fs.existsSync(index)) res.sendFile(index);
  else res.status(404).send('Not found');
});

app.listen(PORT, function () {
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Admin:  http://localhost:${PORT}/admin/`);
  console.log(`Senha padrao: ${ADMIN_PASSWORD} (defina ADMIN_PASSWORD no .env)`);
});
