const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-before-deploying';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');

app.use(cors({
  origin: FRONTEND_ORIGIN
    ? FRONTEND_ORIGIN.split(',').map((entry) => entry.trim()).filter(Boolean)
    : true
}));
app.use(express.json());

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2));
  }
}

function readStore() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (_err) {
    return { users: {} };
  }
}

function writeStore(store) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function createToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
}

function createDefaultUser(username) {
  const displayName = String(username || 'user').trim().toLowerCase();
  const initial = displayName[0]?.toUpperCase() || 'U';
  return {
    username: displayName,
    name: displayName,
    description: 'No description set.',
    tags: 'Not set',
    customFields: 'Not set',
    profilePhoto: initial,
    banner: `${displayName} Banner`,
    color: '#6c63ff',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ error: 'Missing auth token.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = payload;
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid or expired auth token.' });
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ispd7-backend' });
});

app.post('/api/auth/signup', async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!/^[a-z0-9_-]{2,32}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 2-32 characters using letters, numbers, _ or -.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const store = readStore();
  if (store.users[username]) {
    return res.status(409).json({ error: 'That username is already taken.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    ...createDefaultUser(username),
    passwordHash
  };

  store.users[username] = user;
  writeStore(store);

  return res.status(201).json({
    token: createToken(username),
    account: sanitizeUser(user)
  });
});

app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const store = readStore();
  const user = store.users[username];

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const matches = await bcrypt.compare(password, user.passwordHash || '');
  if (!matches) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  return res.json({
    token: createToken(username),
    account: sanitizeUser(user)
  });
});

app.get('/api/me', authRequired, (req, res) => {
  const store = readStore();
  const user = store.users[req.auth.username];

  if (!user) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  return res.json({ account: sanitizeUser(user) });
});

app.put('/api/me', authRequired, async (req, res) => {
  const store = readStore();
  const currentUsername = req.auth.username;
  const currentUser = store.users[currentUsername];

  if (!currentUser) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  const requestedUsername = String(req.body?.username || currentUsername).trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,32}$/.test(requestedUsername)) {
    return res.status(400).json({ error: 'Username must be 2-32 characters using letters, numbers, _ or -.' });
  }
  if (requestedUsername !== currentUsername && store.users[requestedUsername]) {
    return res.status(409).json({ error: 'That username is already taken.' });
  }

  const updatedUser = {
    ...currentUser,
    username: requestedUsername,
    name: String(req.body?.name || currentUser.name || requestedUsername).trim() || requestedUsername,
    description: String(req.body?.description || currentUser.description || 'No description set.'),
    tags: String(req.body?.tags || currentUser.tags || 'Not set'),
    customFields: String(req.body?.customFields || currentUser.customFields || 'Not set'),
    profilePhoto: String(req.body?.profilePhoto || currentUser.profilePhoto || requestedUsername[0]?.toUpperCase() || 'U'),
    banner: String(req.body?.banner || currentUser.banner || `${requestedUsername} Banner`),
    color: String(req.body?.color || currentUser.color || '#6c63ff'),
    updatedAt: new Date().toISOString()
  };

  const newPassword = String(req.body?.newPassword || '');
  if (newPassword) {
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    updatedUser.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  if (requestedUsername !== currentUsername) {
    delete store.users[currentUsername];
  }
  store.users[requestedUsername] = updatedUser;
  writeStore(store);

  return res.json({
    token: createToken(requestedUsername),
    account: sanitizeUser(updatedUser)
  });
});

app.delete('/api/me', authRequired, (req, res) => {
  const store = readStore();
  const currentUsername = req.auth.username;

  if (!store.users[currentUsername]) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  delete store.users[currentUsername];
  writeStore(store);
  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`ISPD7 backend running on http://localhost:${PORT}`);
});
