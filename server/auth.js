const express = require('express');
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');

const router = express.Router();
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// ── Sessions stored in memory (cleared on server restart) ──
const sessions = new Map(); // token → { userId, username }

// ── Helpers ────────────────────────────────────────────────
function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch { return []; }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ── Auth middleware (exported for use by other routers) ─────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.slice(7);
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: 'Invalid or expired token' });
  req.user = session;
  next();
}

// ── POST /api/auth/register ────────────────────────────────
router.post('/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'שם משתמש וסיסמה נדרשים' });
  }
  if (username.length < 2 || username.length > 20) {
    return res.status(400).json({ error: 'שם משתמש חייב להיות 2–20 תווים' });
  }
  if (password.length < 3) {
    return res.status(400).json({ error: 'סיסמה חייבת להיות לפחות 3 תווים' });
  }

  const users = loadUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: 'שם המשתמש כבר תפוס' });
  }

  const user = {
    id:           crypto.randomUUID(),
    username,
    passwordHash: sha256(password),
    createdAt:    new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);

  const token = randomToken();
  sessions.set(token, { userId: user.id, username: user.username });

  res.json({ token, userId: user.id, username: user.username });
});

// ── POST /api/auth/login ───────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'שם משתמש וסיסמה נדרשים' });
  }

  const users = loadUsers();
  const user  = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user || user.passwordHash !== sha256(password)) {
    return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
  }

  const token = randomToken();
  sessions.set(token, { userId: user.id, username: user.username });

  res.json({ token, userId: user.id, username: user.username });
});

// ── POST /api/auth/logout ──────────────────────────────────
router.post('/logout', (req, res) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) sessions.delete(auth.slice(7));
  res.json({ ok: true });
});

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.sessions    = sessions;   // shared with multiplayer.js
