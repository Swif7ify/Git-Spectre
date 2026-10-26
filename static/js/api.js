/**
 * Git-Spectre Backend API Client
 * Wraps all FastAPI endpoints with consistent error handling.
 */

export async function analyzeProfile(username, token = null) {
  const resp = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: username.trim(),
      github_token: token || null,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.detail || `Scan failed (HTTP ${resp.status})`);
  }
  return data;
}

export async function compareProfiles(usernameA, usernameB, token = null) {
  const resp = await fetch('/api/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username_a: usernameA.trim(),
      username_b: usernameB.trim(),
      github_token: token || null,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.detail || `Comparison failed (HTTP ${resp.status})`);
  }
  return data;
}

export async function batchAnalyze(usernames, token = null) {
  const resp = await fetch('/api/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usernames: usernames.map(u => u.trim()),
      github_token: token || null,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.detail || `Batch screener failed (HTTP ${resp.status})`);
  }
  return data;
}

export async function getRateLimit() {
  try {
    const resp = await fetch('/api/rate-limit');
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export async function getReadme(username) {
  try {
    const resp = await fetch(`/api/readme/${encodeURIComponent(username)}`);
    if (!resp.ok) return { found: false, content: '' };
    return await resp.json();
  } catch {
    return { found: false, content: '' };
  }
}

export async function getVersion() {
  try {
    const resp = await fetch('/api/version');
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export async function getRepoInfo() {
  try {
    const resp = await fetch('/api/repo-info');
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// In-memory request cache for leaderboard queries to prevent network spam on timeframe toggling
const _leaderboardCache = new Map();
const LEADERBOARD_CACHE_TTL_MS = 60 * 1000;

export function clearLeaderboardClientCache() {
  _leaderboardCache.clear();
  _cachedLanguages = null;
  _cachedLanguagesEpoch = 0;
}

export function hasLeaderboardCache({ period = 'daily', limit = 50, language = '', q = '' } = {}) {
  const cacheKey = `${period}:${limit}:${(language || '').trim().toLowerCase()}:${(q || '').trim().toLowerCase()}`;
  if (_leaderboardCache.has(cacheKey)) {
    const entry = _leaderboardCache.get(cacheKey);
    return (Date.now() - entry.timestamp) < LEADERBOARD_CACHE_TTL_MS;
  }
  return false;
}

export async function getLeaderboard({
  period = 'daily',
  limit = 50,
  language = '',
  q = '',
  forceRefresh = false,
} = {}) {
  const cacheKey = `${period}:${limit}:${(language || '').trim().toLowerCase()}:${(q || '').trim().toLowerCase()}`;
  const now = Date.now();

  if (!forceRefresh && _leaderboardCache.has(cacheKey)) {
    const entry = _leaderboardCache.get(cacheKey);
    if ((now - entry.timestamp) < LEADERBOARD_CACHE_TTL_MS) {
      return entry.data;
    }
    _leaderboardCache.delete(cacheKey);
  }

  try {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    if (limit) params.append('limit', limit);
    if (language) params.append('language', language);
    if (q) params.append('q', q);

    const resp = await fetch(`/api/leaderboard?${params.toString()}`);
    if (!resp.ok) {
      throw new Error(`Failed to load leaderboard (HTTP ${resp.status})`);
    }
    const data = await resp.json();

    _leaderboardCache.set(cacheKey, { timestamp: now, data });
    if (_leaderboardCache.size > 100) {
      const oldestKey = _leaderboardCache.keys().next().value;
      _leaderboardCache.delete(oldestKey);
    }

    return data;
  } catch (err) {
    console.error('getLeaderboard error:', err);
    if (_leaderboardCache.has(cacheKey)) {
      return _leaderboardCache.get(cacheKey).data;
    }
    return { period, total: 0, leaderboard: [] };
  }
}

export async function getLeaderboardRank(username) {
  try {
    const resp = await fetch(`/api/leaderboard/rank/${encodeURIComponent(username)}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

let _cachedLanguages = null;
let _cachedLanguagesEpoch = 0;
const LANG_CACHE_TTL_MS = 60 * 1000;

export async function getLeaderboardLanguages(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _cachedLanguages && (now - _cachedLanguagesEpoch) < LANG_CACHE_TTL_MS) {
    return _cachedLanguages;
  }
  try {
    const resp = await fetch('/api/leaderboard/languages');
    if (!resp.ok) return _cachedLanguages || { total: 0, languages: [], details: [] };
    const data = await resp.json();
    _cachedLanguages = data;
    _cachedLanguagesEpoch = now;
    return data;
  } catch (err) {
    console.error('getLeaderboardLanguages error:', err);
    return _cachedLanguages || { total: 0, languages: [], details: [] };
  }
}


