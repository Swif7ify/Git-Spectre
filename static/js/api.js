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
