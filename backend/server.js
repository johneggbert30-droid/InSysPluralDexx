const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-before-deploying';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '';
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const DATA_FILE = path.join(DATA_DIR, 'users.json');
const BACKUP_DATA_FILE = path.join(DATA_DIR, 'users.backup.json');
const MAX_HUB_STATE_BYTES = Number(process.env.MAX_HUB_STATE_BYTES || 14 * 1024 * 1024);
const MAX_SYSTEMS_PER_ACCOUNT = Number(process.env.MAX_SYSTEMS_PER_ACCOUNT || 10);
const MAX_HEADMATES_PER_ACCOUNT = Number(process.env.MAX_HEADMATES_PER_ACCOUNT || 2000);
const REMOVED_ACCOUNT_USERNAMES = new Set(['pandorasbox']);
const STORE_KEY = 'users';
const DEFAULT_STORE = { users: {} };
let pool = DATABASE_URL
  ? new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
  })
  : null;

function fallbackToFileStore(error) {
  if (!pool) return;
  const activePool = pool;
  pool = null;
  console.warn('Postgres unavailable, falling back to file persistence.', error?.message || error);
  Promise.resolve(activePool.end()).catch(() => {});
}

app.use(cors({
  origin: FRONTEND_ORIGIN
    ? FRONTEND_ORIGIN.split(',').map((entry) => entry.trim()).filter(Boolean)
    : true
}));
app.use(express.json({ limit: '20mb' }));

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2));
  }
}

function sanitizeStore(store = DEFAULT_STORE) {
  const safeStore = store && typeof store === 'object' ? store : { users: {} };
  if (!safeStore.users || typeof safeStore.users !== 'object' || Array.isArray(safeStore.users)) {
    safeStore.users = {};
  }

  let changed = false;
  Object.keys(safeStore.users).forEach((username) => {
    const normalized = String(username || '').trim().toLowerCase();
    if (!normalized || REMOVED_ACCOUNT_USERNAMES.has(normalized)) {
      delete safeStore.users[username];
      changed = true;
      return;
    }
    if (username !== normalized) {
      safeStore.users[normalized] = safeStore.users[username];
      delete safeStore.users[username];
      changed = true;
    }
  });

  Object.values(safeStore.users).forEach((user) => {
    if (!user || typeof user !== 'object') return;
    const normalizedUsername = String(user.username || '').trim().toLowerCase();
    if (normalizedUsername && user.username !== normalizedUsername) {
      user.username = normalizedUsername;
      changed = true;
    }

    if (!user.friends || typeof user.friends !== 'object' || Array.isArray(user.friends)) {
      user.friends = {};
      changed = true;
      return;
    }

    Object.keys(user.friends).forEach((friendUsername) => {
      const normalizedFriend = String(friendUsername || '').trim().toLowerCase();
      if (!normalizedFriend || REMOVED_ACCOUNT_USERNAMES.has(normalizedFriend) || !safeStore.users[normalizedFriend]) {
        delete user.friends[friendUsername];
        changed = true;
        return;
      }
      if (friendUsername !== normalizedFriend) {
        user.friends[normalizedFriend] = user.friends[friendUsername];
        delete user.friends[friendUsername];
        changed = true;
      }
    });
  });

  return { safeStore, changed };
}

async function initDatabaseStore() {
  if (!pool) return;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_store (
        store_key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(
      `INSERT INTO app_store (store_key, payload)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (store_key) DO NOTHING`,
      [STORE_KEY, JSON.stringify(DEFAULT_STORE)]
    );
  } catch (error) {
    fallbackToFileStore(error);
  }
}

async function readStore() {
  if (pool) {
    try {
      const result = await pool.query('SELECT payload FROM app_store WHERE store_key = $1', [STORE_KEY]);
      const parsed = result.rows[0]?.payload || DEFAULT_STORE;
      const { safeStore, changed } = sanitizeStore(cloneJson(parsed, DEFAULT_STORE));
      if (changed) {
        await writeStore(safeStore);
      }
      return safeStore;
    } catch (error) {
      fallbackToFileStore(error);
    }
  }

  ensureDataFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const { safeStore, changed } = sanitizeStore(parsed);
    if (changed) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(safeStore, null, 2));
    }
    return safeStore;
  } catch (_err) {
    try {
      if (fs.existsSync(BACKUP_DATA_FILE)) {
        const backupParsed = JSON.parse(fs.readFileSync(BACKUP_DATA_FILE, 'utf8'));
        const { safeStore } = sanitizeStore(backupParsed);
        fs.writeFileSync(DATA_FILE, JSON.stringify(safeStore, null, 2));
        return safeStore;
      }
    } catch (_backupErr) {
      // Ignore backup read failures and fall back to empty store.
    }
    return { users: {} };
  }
}

async function writeStore(store) {
  if (pool) {
    try {
      const { safeStore } = sanitizeStore(store);
      await pool.query(
        `INSERT INTO app_store (store_key, payload, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (store_key)
         DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
        [STORE_KEY, JSON.stringify(safeStore)]
      );
      return;
    } catch (error) {
      fallbackToFileStore(error);
    }
  }

  ensureDataFile();
  const { safeStore } = sanitizeStore(store);
  fs.writeFileSync(DATA_FILE, JSON.stringify(safeStore, null, 2));
  fs.writeFileSync(BACKUP_DATA_FILE, JSON.stringify(safeStore, null, 2));
}

const TRUST_LEVELS = ['public', 'friends', 'trusted', 'partners', 'private'];

function normalizeTrustLevel(level, fallback = 'friends') {
  const normalized = String(level || '').trim().toLowerCase();
  return TRUST_LEVELS.includes(normalized) ? normalized : fallback;
}

function cloneJson(value, fallback = {}) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch (_err) {
    return Array.isArray(fallback) ? [...fallback] : { ...fallback };
  }
}

function isEmbeddedMediaValue(value) {
  return /^data:image\//i.test(String(value || '').trim());
}

function createCompactMediaPlaceholder(keyHint = '') {
  return keyHint === 'profilePhoto' ? '' : 'Uploaded media omitted from compact backup';
}

function stripEmbeddedMedia(value, keyHint = '') {
  if (typeof value === 'string') {
    return isEmbeddedMediaValue(value) ? createCompactMediaPlaceholder(keyHint) : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => stripEmbeddedMedia(entry, keyHint));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const output = {};
  Object.entries(value).forEach(([key, entry]) => {
    output[key] = stripEmbeddedMedia(entry, key);
  });
  return output;
}

function normalizeHubState(hubState = {}) {
  if (!hubState || typeof hubState !== 'object' || Array.isArray(hubState)) {
    return { version: 1, updatedAt: new Date().toISOString(), activeUser: 'No system' };
  }
  const cloned = cloneJson(hubState, {});
  if (!cloned.version) cloned.version = 1;
  if (!cloned.updatedAt) cloned.updatedAt = new Date().toISOString();
  if (!cloned.activeUser) cloned.activeUser = 'No system';
  return cloned;
}

function getHubStateCounts(hubState = {}) {
  const systemCount = Object.keys(hubState?.systemProfiles || {}).length;
  const headmateCount = Object.values(hubState?.headmateProfilesByUser || {}).reduce((sum, profiles) => {
    return sum + Object.keys(profiles || {}).length;
  }, 0);
  return { systemCount, headmateCount };
}

function validateHubStateLimits(hubState = {}) {
  const { systemCount, headmateCount } = getHubStateCounts(hubState);
  if (systemCount > MAX_SYSTEMS_PER_ACCOUNT) {
    return `Each account can store up to ${MAX_SYSTEMS_PER_ACCOUNT} systems.`;
  }
  if (headmateCount > MAX_HEADMATES_PER_ACCOUNT) {
    return `Each account can store up to ${MAX_HEADMATES_PER_ACCOUNT} total headmates across all systems.`;
  }
  return '';
}

function sanitizeUser(user, store = { users: {} }, viewerUsername = '') {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  const friends = user.friends && typeof user.friends === 'object' ? { ...user.friends } : {};

  safeUser.friends = friends;
  safeUser.hubState = normalizeHubState(user.hubState || {});
  safeUser.friendProfiles = Object.entries(friends).map(([username, trustLevel]) => {
    const friend = store.users?.[username];
    return {
      username,
      name: friend?.name || username,
      profilePhoto: friend?.profilePhoto || username[0]?.toUpperCase() || 'U',
      color: friend?.color || '#6c63ff',
      tags: friend?.tags || 'Not set',
      trustLevel: normalizeTrustLevel(trustLevel, 'friends'),
      theirTrustLevel: normalizeTrustLevel(friend?.friends?.[user.username], '')
    };
  });
  safeUser.viewerTrustLevel = viewerUsername && viewerUsername !== user.username
    ? normalizeTrustLevel(friends[viewerUsername], 'public')
    : 'private';

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
    friends: {},
    hubState: {
      version: 1,
      updatedAt: new Date().toISOString(),
      activeUser: 'No system'
    },
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
  res.json({ ok: true, service: 'ispd7-backend', persistence: pool ? 'postgres' : 'file' });
});

app.post('/api/auth/signup', async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!/^[a-z0-9_-]{2,32}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 2-32 characters using letters, numbers, _ or -.' });
  }
  if (REMOVED_ACCOUNT_USERNAMES.has(username)) {
    return res.status(403).json({ error: 'That username is unavailable.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const store = await readStore();
  if (store.users[username]) {
    return res.status(409).json({ error: 'That username is already taken.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    ...createDefaultUser(username),
    passwordHash
  };

  store.users[username] = user;
  await writeStore(store);

  return res.status(201).json({
    token: createToken(username),
    account: sanitizeUser(user, store, username)
  });
});

app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const store = await readStore();
  const user = store.users[username];

  if (!/^[a-z0-9_-]{2,32}$/.test(username)) {
    return res.status(400).json({ error: 'Enter a valid username using 2-32 letters, numbers, _ or -.' });
  }

  if (!user) {
    return res.status(404).json({ error: 'No account exists with that username.' });
  }

  const matches = await bcrypt.compare(password, user.passwordHash || '');
  if (!matches) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  return res.json({
    token: createToken(username),
    account: sanitizeUser(user, store, username)
  });
});

app.get('/api/accounts', authRequired, async (req, res) => {
  const store = await readStore();
  const viewerUsername = req.auth.username;
  const viewer = store.users[viewerUsername];

  if (!viewer) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  const accounts = Object.values(store.users || {})
    .filter(Boolean)
    .map((user) => ({
      username: user.username,
      name: user.name || user.username,
      description: user.description || 'No description set.',
      tags: user.tags || 'Not set',
      profilePhoto: user.profilePhoto || user.username?.[0]?.toUpperCase() || 'U',
      color: user.color || '#6c63ff',
      trustLevel: normalizeTrustLevel(viewer.friends?.[user.username], ''),
      theirTrustLevel: normalizeTrustLevel(user.friends?.[viewerUsername], ''),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }))
    .sort((a, b) => String(a.name || a.username).localeCompare(String(b.name || b.username)));

  return res.json({ accounts });
});

app.get('/api/me', authRequired, async (req, res) => {
  const store = await readStore();
  const user = store.users[req.auth.username];

  if (!user) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  return res.json({ account: sanitizeUser(user, store, req.auth.username) });
});

app.put('/api/me', authRequired, async (req, res) => {
  const store = await readStore();
  const currentUsername = req.auth.username;
  const currentUser = store.users[currentUsername];

  if (!currentUser) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  const requestedUsername = String(req.body?.username || currentUsername).trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,32}$/.test(requestedUsername)) {
    return res.status(400).json({ error: 'Username must be 2-32 characters using letters, numbers, _ or -.' });
  }
  if (REMOVED_ACCOUNT_USERNAMES.has(requestedUsername)) {
    return res.status(403).json({ error: 'That username is unavailable.' });
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
    Object.values(store.users).forEach((userEntry) => {
      if (!userEntry?.friends || !userEntry.friends[currentUsername]) return;
      userEntry.friends[requestedUsername] = userEntry.friends[currentUsername];
      delete userEntry.friends[currentUsername];
    });
    delete store.users[currentUsername];
  }
  store.users[requestedUsername] = updatedUser;
  await writeStore(store);

  return res.json({
    token: createToken(requestedUsername),
    account: sanitizeUser(updatedUser, store, requestedUsername)
  });
});

app.get('/api/me/state', authRequired, async (req, res) => {
  const store = await readStore();
  const user = store.users[req.auth.username];

  if (!user) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  return res.json({ hubState: normalizeHubState(user.hubState || {}) });
});

app.put('/api/me/state', authRequired, async (req, res) => {
  const store = await readStore();
  const currentUser = store.users[req.auth.username];

  if (!currentUser) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  const hubState = req.body?.hubState;
  if (!hubState || typeof hubState !== 'object' || Array.isArray(hubState)) {
    return res.status(400).json({ error: 'hubState must be a JSON object.' });
  }

  const serialized = JSON.stringify(hubState);
  let parsedHubState = normalizeHubState(JSON.parse(serialized));
  let compactedForStorage = false;

  if (Buffer.byteLength(serialized, 'utf8') > MAX_HUB_STATE_BYTES) {
    parsedHubState = normalizeHubState(stripEmbeddedMedia(parsedHubState));
    const compactSerialized = JSON.stringify(parsedHubState);
    if (Buffer.byteLength(compactSerialized, 'utf8') > MAX_HUB_STATE_BYTES) {
      return res.status(413).json({ error: 'Saved hub state is too large.' });
    }
    compactedForStorage = true;
  }

  const limitError = validateHubStateLimits(parsedHubState);
  if (limitError) {
    return res.status(400).json({ error: limitError });
  }

  const accountPatch = req.body?.account;
  if (accountPatch && typeof accountPatch === 'object' && !Array.isArray(accountPatch)) {
    currentUser.name = String(accountPatch.name || currentUser.name || req.auth.username).trim() || req.auth.username;
    currentUser.description = String(accountPatch.description || currentUser.description || 'No description set.');
    currentUser.tags = String(accountPatch.tags || currentUser.tags || 'Not set');
    currentUser.customFields = String(accountPatch.customFields || currentUser.customFields || 'Not set');
    currentUser.profilePhoto = String(accountPatch.profilePhoto || currentUser.profilePhoto || req.auth.username?.[0]?.toUpperCase() || 'U');
    currentUser.banner = String(accountPatch.banner || currentUser.banner || `${req.auth.username} Banner`);
    currentUser.color = String(accountPatch.color || currentUser.color || '#6c63ff');
  }

  currentUser.hubState = parsedHubState;
  currentUser.hubState.updatedAt = new Date().toISOString();
  currentUser.updatedAt = new Date().toISOString();
  store.users[req.auth.username] = currentUser;
  await writeStore(store);

  return res.json({
    ok: true,
    compacted: compactedForStorage,
    hubState: currentUser.hubState,
    account: sanitizeUser(currentUser, store, req.auth.username)
  });
});

app.post('/api/friends', authRequired, async (req, res) => {
  const store = await readStore();
  const currentUsername = req.auth.username;
  const friendUsername = String(req.body?.username || '').trim().toLowerCase();
  const trustLevel = normalizeTrustLevel(req.body?.trustLevel, 'friends');
  const currentUser = store.users[currentUsername];
  const friendUser = store.users[friendUsername];

  if (!currentUser) {
    return res.status(404).json({ error: 'Account not found.' });
  }
  if (!friendUsername) {
    return res.status(400).json({ error: 'Friend username is required.' });
  }
  if (friendUsername === currentUsername) {
    return res.status(400).json({ error: 'You cannot add your own account as a friend.' });
  }
  if (!friendUser) {
    return res.status(404).json({ error: 'No account exists with that username yet.' });
  }

  currentUser.friends = { ...(currentUser.friends || {}), [friendUsername]: trustLevel };
  friendUser.friends = {
    ...(friendUser.friends || {}),
    [currentUsername]: normalizeTrustLevel(friendUser.friends?.[currentUsername], 'friends')
  };
  currentUser.updatedAt = new Date().toISOString();
  friendUser.updatedAt = new Date().toISOString();
  store.users[currentUsername] = currentUser;
  store.users[friendUsername] = friendUser;
  await writeStore(store);

  return res.json({
    account: sanitizeUser(currentUser, store, currentUsername),
    friend: sanitizeUser(friendUser, store, currentUsername)
  });
});

app.delete('/api/friends/:username', authRequired, async (req, res) => {
  const store = await readStore();
  const currentUsername = req.auth.username;
  const friendUsername = String(req.params?.username || '').trim().toLowerCase();
  const currentUser = store.users[currentUsername];
  const friendUser = store.users[friendUsername];

  if (!currentUser) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  if (currentUser.friends) delete currentUser.friends[friendUsername];
  if (friendUser?.friends) delete friendUser.friends[currentUsername];
  currentUser.updatedAt = new Date().toISOString();
  if (friendUser) friendUser.updatedAt = new Date().toISOString();
  store.users[currentUsername] = currentUser;
  if (friendUser) store.users[friendUsername] = friendUser;
  await writeStore(store);

  return res.json({
    account: sanitizeUser(currentUser, store, currentUsername)
  });
});

app.delete('/api/me', authRequired, async (req, res) => {
  const store = await readStore();
  const currentUsername = req.auth.username;

  if (!store.users[currentUsername]) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  Object.values(store.users).forEach((userEntry) => {
    if (userEntry?.friends && userEntry.friends[currentUsername]) {
      delete userEntry.friends[currentUsername];
    }
  });
  delete store.users[currentUsername];
  await writeStore(store);
  return res.json({ ok: true });
});

async function startServer() {
  app.listen(PORT, async () => {
    console.log(`ISPD7 backend running on http://localhost:${PORT} using ${pool ? 'postgres' : 'file'} persistence`);
    try {
      await initDatabaseStore();
      console.log(`ISPD7 persistence ready: ${pool ? 'postgres' : 'file'}`);
    } catch (error) {
      fallbackToFileStore(error);
      console.log('ISPD7 persistence ready: file');
    }
  });
}

startServer();
