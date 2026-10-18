/**
 * Navigation Bar Component
 * Handles the top bar, live API rate limiter countdown, and action modal triggers.
 */

import { getRateLimit } from '../api.js';
import { getToken, getTheme, toggleTheme } from '../state.js';

let _rateLimitTimer = null;
let _resetEpoch = 0;

export function initNav({ onHome, onCompare, onBatch, onVault }) {
  // Brand Home click
  const logoBtn = document.getElementById('navLogoBtn');
  if (logoBtn) {
    logoBtn.addEventListener('click', () => onHome());
  }

  // Modals buttons
  const compareBtn = document.getElementById('navCompareBtn');
  if (compareBtn) {
    compareBtn.addEventListener('click', () => onCompare());
  }

  const batchBtn = document.getElementById('navBatchBtn');
  if (batchBtn) {
    batchBtn.addEventListener('click', () => onBatch());
  }

  const vaultBtn = document.getElementById('navVaultBtn');
  if (vaultBtn) {
    vaultBtn.addEventListener('click', () => onVault());
  }

  // Theme toggle
  const themeBtn = document.getElementById('navThemeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      toggleTheme();
      updateThemeIcon();
    });
  }
  updateThemeIcon();
  updateVaultStatus();

  // Initial rate limit fetch & recurring poll
  refreshRateLimit();
  setInterval(refreshRateLimit, 60000);
}

export function updateVaultStatus() {
  const dot = document.getElementById('navVaultDot');
  if (dot) {
    const hasToken = Boolean(getToken());
    dot.className = `absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2 ring-surface ${hasToken ? 'bg-lime' : 'bg-faint'}`;
  }
}

export function updateThemeIcon() {
  const isDark = getTheme() === 'dark';
  const moon = document.getElementById('navIconMoon');
  const sun = document.getElementById('navIconSun');
  if (moon && sun) {
    moon.classList.toggle('hidden', !isDark);
    sun.classList.toggle('hidden', isDark);
  }
}

export async function refreshRateLimit() {
  const data = await getRateLimit();
  if (!data) return;

  const { limit = 60, remaining = 0, reset = 0 } = data;
  _resetEpoch = reset;

  const bar = document.getElementById('navRlBar');
  const text = document.getElementById('navRlText');
  const timer = document.getElementById('navRlTimer');

  if (bar) {
    const pct = Math.max(0, Math.min(100, (remaining / limit) * 100));
    bar.style.width = `${pct}%`;
    bar.className = `h-full rounded-full transition-all duration-300 ${
      pct > 50 ? 'bg-ok' : pct > 20 ? 'bg-warn' : 'bg-danger'
    }`;
  }

  if (text) {
    text.textContent = `${remaining.toLocaleString()}/${limit.toLocaleString()}`;
  }

  if (timer) {
    const pct = (remaining / limit) * 100;
    if (pct < 25 && reset > 0) {
      startCountdown();
    } else {
      clearInterval(_rateLimitTimer);
      timer.textContent = '';
      timer.classList.add('hidden');
    }
  }
}

function startCountdown() {
  clearInterval(_rateLimitTimer);
  const timer = document.getElementById('navRlTimer');
  if (!timer) return;
  timer.classList.remove('hidden');

  const tick = () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, _resetEpoch - nowSec);
    if (diff <= 0) {
      timer.textContent = '';
      timer.classList.add('hidden');
      clearInterval(_rateLimitTimer);
      refreshRateLimit();
      return;
    }
    const mins = Math.floor(diff / 60);
    const secs = String(diff % 60).padStart(2, '0');
    timer.textContent = `${mins}:${secs}`;
  };

  tick();
  _rateLimitTimer = setInterval(tick, 1000);
}
