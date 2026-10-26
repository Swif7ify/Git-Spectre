/**
 * Navigation Bar Component
 * Handles the top bar, live API rate limiter countdown, and action modal triggers.
 */

import { getRateLimit, getVersion, getRepoInfo } from '../api.js';
import { getToken, getTheme, toggleTheme } from '../state.js';

let _rateLimitTimer = null;
let _resetEpoch = 0;

export function initNav({ onHome, onCompare, onBatch, onVault }) {
  // Brand Home click
  const logoBtn = document.getElementById('navLogoBtn');
  if (logoBtn) {
    logoBtn.addEventListener('click', () => {
      closeMobileDrawer();
      onHome();
    });
  }

  // Desktop action modal buttons
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

  // Desktop theme toggle
  const themeBtn = document.getElementById('navThemeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      toggleTheme();
      updateThemeIcon();
    });
  }

  // Mobile hamburger menu toggle
  const mobileMenuBtn = document.getElementById('navMobileMenuBtn');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMobileDrawer();
    });
  }

  // Mobile action modal buttons
  const mobileCompareBtn = document.getElementById('navMobileCompareBtn');
  if (mobileCompareBtn) {
    mobileCompareBtn.addEventListener('click', () => {
      closeMobileDrawer();
      onCompare();
    });
  }

  const mobileBatchBtn = document.getElementById('navMobileBatchBtn');
  if (mobileBatchBtn) {
    mobileBatchBtn.addEventListener('click', () => {
      closeMobileDrawer();
      onBatch();
    });
  }

  const mobileVaultBtn = document.getElementById('navMobileVaultBtn');
  if (mobileVaultBtn) {
    mobileVaultBtn.addEventListener('click', () => {
      closeMobileDrawer();
      onVault();
    });
  }

  const mobileThemeBtn = document.getElementById('navMobileThemeBtn');
  if (mobileThemeBtn) {
    mobileThemeBtn.addEventListener('click', () => {
      toggleTheme();
      updateThemeIcon();
    });
  }

  // Dismiss mobile drawer when clicking outside nav or pressing Escape
  document.addEventListener('click', (e) => {
    const nav = document.querySelector('nav');
    if (nav && !nav.contains(e.target)) {
      closeMobileDrawer();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileDrawer();
    }
  });

  updateThemeIcon();
  updateVaultStatus();

  // Initial rate limit fetch & recurring poll
  refreshRateLimit();
  setInterval(refreshRateLimit, 60000);

  // Synchronize dynamic application version badges and repo stars
  syncVersion();
  syncRepoInfo();
}

export function toggleMobileDrawer() {
  const drawer = document.getElementById('navMobileDrawer');
  const burger = document.getElementById('navMobileMenuIconBurger');
  const close = document.getElementById('navMobileMenuIconClose');
  const btn = document.getElementById('navMobileMenuBtn');
  if (!drawer) return;

  const isClosed = drawer.classList.contains('hidden');
  if (isClosed) {
    drawer.classList.remove('hidden');
    if (burger) burger.classList.add('hidden');
    if (close) close.classList.remove('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  } else {
    closeMobileDrawer();
  }
}

export function closeMobileDrawer() {
  const drawer = document.getElementById('navMobileDrawer');
  const burger = document.getElementById('navMobileMenuIconBurger');
  const close = document.getElementById('navMobileMenuIconClose');
  const btn = document.getElementById('navMobileMenuBtn');
  if (!drawer) return;

  drawer.classList.add('hidden');
  if (burger) burger.classList.remove('hidden');
  if (close) close.classList.add('hidden');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

export async function syncVersion() {
  const data = await getVersion();
  if (!data) return;
  const navBadge = document.getElementById('navVersionBadge');
  if (navBadge && data.short) {
    navBadge.textContent = data.short;
  }
  const heroBadge = document.getElementById('heroVersionBadge');
  if (heroBadge && data.major) {
    heroBadge.textContent = `INTELLIGENCE SYSTEM ${data.major} ONLINE`;
  }
}

export async function syncRepoInfo() {
  const data = await getRepoInfo();
  if (!data) return;

  const githubBtn = document.getElementById('navGithubBtn');
  if (githubBtn && data.url) {
    githubBtn.href = data.url;
  }

  const starCountText = document.getElementById('navStarCountText');
  if (starCountText && typeof data.stars === 'number') {
    starCountText.textContent = data.stars >= 1000
      ? (data.stars / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
      : data.stars.toLocaleString();
  }
}

export function updateVaultStatus() {
  const hasToken = Boolean(getToken());
  const dot = document.getElementById('navVaultDot');
  if (dot) {
    dot.className = `absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2 ring-surface ${hasToken ? 'bg-lime' : 'bg-faint'}`;
  }

  const mobileDot = document.getElementById('navMobileVaultDot');
  if (mobileDot) {
    mobileDot.className = `h-1.5 w-1.5 rounded-full ${hasToken ? 'bg-lime' : 'bg-faint'}`;
  }

  const mobileStatus = document.getElementById('navMobileVaultStatus');
  if (mobileStatus) {
    mobileStatus.textContent = hasToken ? 'Active' : 'No Token';
    mobileStatus.className = hasToken ? 'text-lime font-medium' : 'text-muted';
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

  const mobileIcon = document.getElementById('navMobileThemeIcon');
  if (mobileIcon) {
    mobileIcon.innerHTML = isDark
      ? '<svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 fill-none stroke-currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>'
      : '<svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 fill-none stroke-currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
  }

  const mobileText = document.getElementById('navMobileThemeText');
  if (mobileText) {
    mobileText.textContent = isDark ? 'Dark' : 'Light';
  }
}

export async function refreshRateLimit() {
  const data = await getRateLimit();
  if (!data) return;

  const { limit = 60, remaining = 0, reset = 0 } = data;
  _resetEpoch = reset;

  const pct = Math.max(0, Math.min(100, (remaining / limit) * 100));
  const colorClass = pct > 50 ? 'bg-ok' : pct > 20 ? 'bg-warn' : 'bg-danger';
  const formattedText = `${remaining.toLocaleString()}/${limit.toLocaleString()}`;

  // Update desktop gauge
  const bar = document.getElementById('navRlBar');
  const text = document.getElementById('navRlText');
  const timer = document.getElementById('navRlTimer');

  if (bar) {
    bar.style.width = `${pct}%`;
    bar.className = `h-full rounded-full transition-all duration-300 ${colorClass}`;
  }
  if (text) {
    text.textContent = formattedText;
  }

  // Update mobile drawer gauge
  const mobileBar = document.getElementById('navMobileRlBar');
  const mobileText = document.getElementById('navMobileRlText');
  const mobileTimer = document.getElementById('navMobileRlTimer');

  if (mobileBar) {
    mobileBar.style.width = `${pct}%`;
    mobileBar.className = `h-full rounded-full transition-all duration-300 ${colorClass}`;
  }
  if (mobileText) {
    mobileText.textContent = formattedText;
  }

  if (timer || mobileTimer) {
    if (pct < 25 && reset > 0) {
      startCountdown();
    } else {
      clearInterval(_rateLimitTimer);
      if (timer) {
        timer.textContent = '';
        timer.classList.add('hidden');
      }
      if (mobileTimer) {
        mobileTimer.textContent = '';
        mobileTimer.classList.add('hidden');
      }
    }
  }
}

function startCountdown() {
  clearInterval(_rateLimitTimer);
  const timer = document.getElementById('navRlTimer');
  const mobileTimer = document.getElementById('navMobileRlTimer');
  if (timer) timer.classList.remove('hidden');
  if (mobileTimer) mobileTimer.classList.remove('hidden');

  const tick = () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, _resetEpoch - nowSec);
    if (diff <= 0) {
      if (timer) {
        timer.textContent = '';
        timer.classList.add('hidden');
      }
      if (mobileTimer) {
        mobileTimer.textContent = '';
        mobileTimer.classList.add('hidden');
      }
      clearInterval(_rateLimitTimer);
      refreshRateLimit();
      return;
    }
    const mins = Math.floor(diff / 60);
    const secs = String(diff % 60).padStart(2, '0');
    const timeStr = `${mins}:${secs}`;
    if (timer) timer.textContent = timeStr;
    if (mobileTimer) mobileTimer.textContent = `Reset in ${timeStr}`;
  };

  tick();
  _rateLimitTimer = setInterval(tick, 1000);
}
