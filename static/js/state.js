/**
 * Git-Spectre State Management
 * Handles localStorage persistence (vault token, search history, theme) and runtime state.
 */

import { showToast } from './utils.js';

// ── Token Vault ──
export function getToken() {
  return localStorage.getItem('gs_token') || '';
}

export function setToken(token) {
  const t = (token || '').trim();
  if (t) {
    localStorage.setItem('gs_token', t);
  } else {
    localStorage.removeItem('gs_token');
  }
}

export function clearToken() {
  localStorage.removeItem('gs_token');
}

// ── Search History ──
export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('gs_history') || '[]');
  } catch {
    return [];
  }
}

export function addHistory(login) {
  if (!login) return;
  try {
    let list = getHistory();
    list = [login, ...list.filter(x => x.toLowerCase() !== login.toLowerCase())].slice(0, 10);
    localStorage.setItem('gs_history', JSON.stringify(list));
  } catch {}
}

export function clearHistory() {
  localStorage.removeItem('gs_history');
}

// ── Theme Management ──
export function getTheme() {
  return localStorage.getItem('gs_theme') || 'dark';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.remove('light');
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }
}

export function toggleTheme() {
  const curr = getTheme();
  const next = curr === 'dark' ? 'light' : 'dark';
  localStorage.setItem('gs_theme', next);
  applyTheme(next);
  showToast(next === 'dark' ? 'Dark mode enabled' : 'Light mode enabled', next === 'dark' ? 'moon' : 'sun');
  return next;
}

// ── Runtime Data Store ──
export const appState = {
  activeDossier: null,
  activeCompare: null,
  currentView: 'hero', // 'hero' | 'dossier' | 'compare'
  radarMode: 'kb',     // 'kb' | 'count'
};
