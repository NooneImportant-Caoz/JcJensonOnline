const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const session    = require('express-session');
const bcrypt     = require('bcryptjs');
const nodemailer = require('nodemailer');
const sqlite3    = require('sqlite3').verbose();
const path       = require('path');
const fs         = require('fs');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

const ADMIN_USER  = 'noone';
const ADMIN_PASS  = 'NEONGUN';
const ADMIN_EMAIL = 'newnoonehell@gmail.com';
const PORT = process.env.PORT || 3000;

// Persistent DB — on Render add env var DATA_DIR=/var/data and mount a disk there
const DATA_DIR = process.env.DATA_DIR || '.';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'game.db');

const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE, password TEXT, email TEXT,
    verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS map (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data TEXT DEFAULT '[]', props TEXT DEFAULT '[]',
    spawnX INTEGER DEFAULT 100, spawnY INTEGER DEFAULT 100,
    colliders TEXT DEFAULT '[]', entityColliders TEXT DEFAULT '{}'
  )`);
  db.run(`INSERT OR IGNORE INTO map (id,data,props,spawnX,spawnY,colliders,entityColliders) VALUES (1,'[]','[]',100,100,'[]','{}')`);
});

// ── EMAIL ─────────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: ADMIN_EMAIL, pass: process.env.GMAIL_APP_PASSWORD || '' }
});
transporter.verify(err => {
  if (err) console.log('Email error:', err.message);
  else console.log('Email ready');
});
function sendVerificationEmail(email, username) {
  transporter.sendMail({
    from: `"JcJensonOnline" <${ADMIN_EMAIL}>`,
    to: ADMIN_EMAIL,
    subject: `New Account: ${username}`,
    html: `<h2>New registration</h2><p><b>Username:</b> ${username}</p><p><b>Email:</b> ${email}</p><a href="https://jcjensononline.onrender.com/admin.html">Admin Panel</a>`
  }, (err, info) => {
    if (err) console.log('Send error:', err.message);
    else console.log('Email sent:', info.messageId);
  });
}

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'jcjenson_2024', resave: false, saveUninitialized: false, cookie: { maxAge: 86400000 } }));
app.get('/', (req, res) => res.redirect('/login.html'));

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || !email) return res.json({ ok: false, msg: 'All fields required.' });
  if (username.toLowerCase() === 'noone') return res.json({ ok: false, msg: 'That username is reserved.' });
  const hash = await bcrypt.hash(password, 10);
  db.run(`INSERT INTO users (username,password,email,verified) VALUES (?,?,?,0)`, [username, hash, email], function(err) {
    if (err) return res.json({ ok: false, msg: 'Username already taken.' });
    sendVerificationEmail(email, username);
    res.json({ ok: true, msg: 'Account created! Waiting for admin verification.' });
  });
});
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.user = { id: 0, username: ADMIN_USER, is_admin: true };
    return res.json({ ok: true, admin: true });
  }
  db.get(`SELECT * FROM users WHERE username=?`, [username], async (err, user) => {
    if (!user) return res.json({ ok: false, msg: 'User not found.' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ ok: false, msg: 'Wrong password.' });
    if (!user.verified) return res.json({ ok: false, msg: 'Account not verified yet.' });
    req.session.user = { id: user.id, username: user.username, is_admin: false };
    res.json({ ok: true, admin: false });
  });
});
app.post('/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });
app.get('/me', (req, res) => {
  if (req.session.user) res.json({ ok: true, user: req.session.user });
  else res.json({ ok: false });
});

// ── ADMIN ─────────────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (req.session.user?.is_admin) return next();
  res.status(403).json({ ok: false });
}
app.get('/admin/users', requireAdmin, (req, res) => {
  db.all(`SELECT id,username,email,verified,created_at FROM users ORDER BY created_at DESC`, [], (err, rows) => {
    res.json({ ok: true, users: rows || [] });
  });
});
app.post('/admin/verify', requireAdmin, (req, res) => {
  db.run(`UPDATE users SET verified=? WHERE id=?`, [req.body.verified, req.body.id], err => res.json({ ok: !err }));
});
app.delete('/admin/user/:id', requireAdmin, (req, res) => {
  db.run(`DELETE FROM users WHERE id=?`, [req.params.id], err => res.json({ ok: !err }));
});
app.get('/admin/live', requireAdmin, (req, res) => {
  res.json({ ok: true, players: Object.entries(players).map(([id, p]) => ({ id, ...p })), chat: chatHistory.slice(-50) });
});
app.post('/admin/kick', requireAdmin, (req, res) => {
  const { socketId } = req.body;
  if (!players[socketId]) return res.json({ ok: false });
  io.to(socketId).emit('kick');
  setTimeout(() => { const s = io.sockets.sockets.get(socketId); if (s) s.disconnect(true); }, 800);
  res.json({ ok: true });
});
app.post('/admin/mute', requireAdmin, (req, res) => {
  const { socketId, muted } = req.body;
  if (!players[socketId]) return res.json({ ok: false });
  players[socketId].muted = !!muted;
  io.to(socketId).emit('mute', { muted: !!muted });
  res.json({ ok: true });
});

// ── MAP ───────────────────────────────────────────────────────────────────────
app.get('/map', (req, res) => {
  db.get(`SELECT * FROM map WHERE id=1`, [], (err, row) => {
    res.json({
      ok: true,
      data:            JSON.parse(row?.data            || '[]'),
      props:           JSON.parse(row?.props           || '[]'),
      colliders:       JSON.parse(row?.colliders       || '[]'),
      entityColliders: JSON.parse(row?.entityColliders || '{}'),
      spawnX: row?.spawnX || 100, spawnY: row?.spawnY || 100
    });
  });
});
app.post('/map', requireAdmin, (req, res) => {
  const data            = JSON.stringify(req.body.data            || []);
  const props           = JSON.stringify(req.body.props           || []);
  const colliders       = JSON.stringify(req.body.colliders       || []);
  const entityColliders = JSON.stringify(req.body.entityColliders || {});
  const { spawnX = 100, spawnY = 100 } = req.body;
  db.run(`UPDATE map SET data=?,props=?,colliders=?,entityColliders=?,spawnX=?,spawnY=? WHERE id=1`,
    [data, props, colliders, entityColliders, spawnX, spawnY], err => {
      if (err) return res.json({ ok: false });
      io.emit('mapUpdate', { data: req.body.data || [], props: req.body.props || [], colliders: req.body.colliders || [], entityColliders: req.body.entityColliders || {}, spawnX, spawnY });
      res.json({ ok: true });
    });
});

// ── SOCKETS ───────────────────────────────────────────────────────────────────
const players     = {};
const chatHistory = [];
const MAX_DELTA   = 6; // max pixels per update — prevents speed hacks

io.on('connection', socket => {
  socket.on('join', (username, sprite) => {
    players[socket.id] = { username, x: 100, y: 100, facingLeft: false, muted: false, sprite: sprite || 'player1' };
    socket.emit('currentPlayers', players);
    socket.broadcast.emit('playerJoined', { id: socket.id, ...players[socket.id] });
  });
  socket.on('move', pos => {
    if (!players[socket.id]) return;
    const p = players[socket.id];
    // Clamp movement delta to prevent speed hacks
    const nx = p.x + Math.max(-MAX_DELTA, Math.min(MAX_DELTA, pos.x - p.x));
    const ny = p.y + Math.max(-MAX_DELTA, Math.min(MAX_DELTA, pos.y - p.y));
    p.x = nx; p.y = ny; p.facingLeft = pos.facingLeft;
    socket.broadcast.emit('playerMoved', { id: socket.id, x: p.x, y: p.y, facingLeft: p.facingLeft });
  });
  socket.on('chat', msg => {
    if (!players[socket.id] || players[socket.id].muted) return;
    const safe = String(msg).replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 80);
    const entry = { id: socket.id, username: players[socket.id].username, msg: safe, time: Date.now() };
    chatHistory.push(entry);
    if (chatHistory.length > 50) chatHistory.shift();
    io.emit('chat', entry);
  });
  socket.on('disconnect', () => {
    if (players[socket.id]) { io.emit('playerLeft', socket.id); delete players[socket.id]; }
  });
});

server.listen(PORT, () => console.log(`JcJensonOnline → http://localhost:${PORT}`));