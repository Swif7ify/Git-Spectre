/**
 * Leaderboard Modal Component
 * Global Developer Popularity Ranking across Daily, Monthly, Yearly, and All-Time windows.
 */

import { getLeaderboard } from '../api.js';
import { esc, avatarUrl, compact, full, icon } from '../utils.js';

let _activePeriod = 'daily';
let _activeLanguage = '';
let _searchQuery = '';
let _onOpenDossierCallback = null;
let _isLoading = false;

export function initLeaderboard({ onOpenDossier }) {
  _onOpenDossierCallback = onOpenDossier;

  // Global event delegation for opening leaderboard
  document.querySelectorAll('[data-open-leaderboard]').forEach((btn) => {
    btn.addEventListener('click', () => openLeaderboardModal());
  });

  // Close button
  const closeBtn = document.getElementById('leaderboardCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeLeaderboardModal);
  }

  // Backdrop click
  const backdrop = document.getElementById('leaderboardModal');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeLeaderboardModal();
    });
  }

  // Timeframe Tabs
  const tabBtns = document.querySelectorAll('.leaderboard-tab-btn');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const period = btn.getAttribute('data-period');
      if (period && period !== _activePeriod) {
        _activePeriod = period;
        updateTabStyles();
        fetchAndRenderLeaderboard();
      }
    });
  });

  // Search filter
  const searchInput = document.getElementById('leaderboardSearchInput');
  if (searchInput) {
    let debounceTimer = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        _searchQuery = e.target.value.trim();
        fetchAndRenderLeaderboard();
      }, 250);
    });
  }

  // Language filter select
  const langSelect = document.getElementById('leaderboardLangSelect');
  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      _activeLanguage = e.target.value;
      fetchAndRenderLeaderboard();
    });
  }
}

export function openLeaderboardModal(period = null) {
  if (period) _activePeriod = period;
  const modal = document.getElementById('leaderboardModal');
  if (!modal) return;

  modal.classList.remove('hidden');
  updateTabStyles();
  fetchAndRenderLeaderboard();
}

export function closeLeaderboardModal() {
  const modal = document.getElementById('leaderboardModal');
  if (modal) modal.classList.add('hidden');
}

function updateTabStyles() {
  const tabBtns = document.querySelectorAll('.leaderboard-tab-btn');
  tabBtns.forEach((btn) => {
    const period = btn.getAttribute('data-period');
    const isActive = period === _activePeriod;
    if (isActive) {
      btn.className = 'leaderboard-tab-btn rounded-xl bg-lime px-3.5 py-1.5 font-mono text-xs font-bold text-onlime shadow-sm transition-all';
    } else {
      btn.className = 'leaderboard-tab-btn rounded-xl px-3.5 py-1.5 font-mono text-xs font-medium text-muted hover:bg-raised hover:text-ink transition-colors';
    }
  });
}

async function fetchAndRenderLeaderboard() {
  const podiumContainer = document.getElementById('leaderboardPodium');
  const tableBody = document.getElementById('leaderboardTableBody');
  const countText = document.getElementById('leaderboardMetaCount');
  const loadingIndicator = document.getElementById('leaderboardLoading');

  if (loadingIndicator) loadingIndicator.classList.remove('hidden');

  _isLoading = true;
  try {
    const data = await getLeaderboard({
      period: _activePeriod,
      limit: 50,
      language: _activeLanguage,
      q: _searchQuery,
    });

    const list = data.leaderboard || [];
    if (countText) {
      countText.textContent = `${list.length} verified profile${list.length === 1 ? '' : 's'}`;
    }

    renderPodium(podiumContainer, list.slice(0, 3));
    renderTable(tableBody, list);
  } catch (err) {
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-danger font-mono">Failed to load leaderboard: ${esc(err.message)}</td></tr>`;
    }
  } finally {
    _isLoading = false;
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
  }
}

function renderPodium(container, topThree) {
  if (!container) return;
  if (!topThree || topThree.length === 0) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  // Sort order for visual podium: [2nd (Silver), 1st (Gold), 3rd (Bronze)]
  const first = topThree[0];
  const second = topThree[1] || null;
  const third = topThree[2] || null;

  const cards = [
    { dev: second, rank: 2, label: 'Silver', medal: '🥈', border: 'border-slate-400/40', bg: 'bg-slate-400/5', order: 'order-2 sm:order-1' },
    { dev: first, rank: 1, label: 'Gold', medal: '👑', border: 'border-amber-400/50 ring-2 ring-amber-400/20', bg: 'bg-amber-400/10', order: 'order-1 sm:order-2' },
    { dev: third, rank: 3, label: 'Bronze', medal: '🥉', border: 'border-amber-700/40', bg: 'bg-amber-700/5', order: 'order-3 sm:order-3' },
  ];

  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 items-end">
      ${cards.map((c) => {
        if (!c.dev) {
          return `<div class="${c.order} hidden sm:block p-4 rounded-2xl border border-line/40 bg-surface/30 text-center opacity-30">
            <span class="font-mono text-xs text-muted">Awaiting contender</span>
          </div>`;
        }
        const dev = c.dev;
        const isFirst = c.rank === 1;
        return `
          <div class="${c.order} relative group cursor-pointer overflow-hidden rounded-2xl border ${c.border} ${c.bg} p-4 sm:p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl"
               data-scan-login="${esc(dev.login)}">
            <div class="flex items-center justify-between mb-3">
              <span class="inline-flex items-center gap-1 font-mono text-xs font-bold ${isFirst ? 'text-amber-400' : 'text-muted'}">
                <span>${c.medal}</span> #${dev.rank || c.rank}
              </span>
              <span class="inline-flex items-center gap-1 rounded-full bg-surface/80 border border-line/60 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-limeink">
                ${icon('flame', 'w-3 h-3 text-limeink')} ${full(dev.check_count)} checks
              </span>
            </div>
            <div class="flex items-center gap-3">
              <div class="relative shrink-0">
                <img src="${avatarUrl(dev.login, 120)}" alt="${esc(dev.login)}" class="h-12 w-12 sm:h-14 sm:w-14 rounded-full border border-line bg-surface object-cover" />
                <span class="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-surface border border-line font-mono text-[9px] font-bold text-ink">
                  ${dev.dev_grade || 'A'}
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-semibold text-ink text-sm sm:text-base truncate group-hover:text-accent transition-colors">
                  ${esc(dev.name || dev.login)}
                </div>
                <div class="font-mono text-xs text-muted truncate">@${esc(dev.login)}</div>
                <div class="mt-1 flex items-center gap-2 text-[11px] font-mono text-muted">
                  <span>Score: <b class="text-ink">${dev.dev_score || '—'}</b></span>
                  ${dev.primary_language ? `<span>· ${esc(dev.primary_language)}</span>` : ''}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Attach click listener to podium cards
  container.querySelectorAll('[data-scan-login]').forEach((el) => {
    el.addEventListener('click', () => {
      const login = el.getAttribute('data-scan-login');
      if (login && _onOpenDossierCallback) {
        closeLeaderboardModal();
        _onOpenDossierCallback(login);
      }
    });
  });
}

function renderTable(tableBody, list) {
  if (!tableBody) return;

  if (!list || list.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="py-12 text-center">
          <div class="mx-auto max-w-sm space-y-2">
            <span class="inline-block text-2xl">📡</span>
            <p class="font-mono text-xs font-semibold uppercase tracking-wider text-ink">No Profiles Recorded Yet</p>
            <p class="text-xs text-muted">No developer profiles match the selected timeframe or filter. Analyze a GitHub handle to launch them onto the leaderboard!</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = list.map((dev, idx) => {
    const rankNum = dev.rank || (idx + 1);
    const medalIcon = rankNum === 1 ? '🥇' : rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : `#${rankNum}`;

    return `
      <tr class="group border-b border-line/40 transition-colors hover:bg-raised/60 cursor-pointer" data-scan-login="${esc(dev.login)}">
        <td class="px-4 py-3 text-center font-mono text-xs font-semibold ${rankNum <= 3 ? 'text-ink font-bold' : 'text-muted'}">
          ${medalIcon}
        </td>
        <td class="px-4 py-3 min-w-[180px]">
          <div class="flex items-center gap-3">
            <img src="${avatarUrl(dev.login, 60)}" alt="" class="h-8 w-8 rounded-full border border-line bg-surface object-cover shrink-0" />
            <div class="min-w-0">
              <div class="font-semibold text-xs text-ink truncate group-hover:text-accent transition-colors">
                ${esc(dev.name || dev.login)}
              </div>
              <div class="font-mono text-[11px] text-muted truncate">@${esc(dev.login)}</div>
            </div>
          </div>
        </td>
        <td class="px-4 py-3 whitespace-nowrap">
          <div class="flex items-center gap-1.5 font-mono text-xs">
            <span class="rounded bg-surface px-1.5 py-0.5 border border-line text-[10px] font-bold text-accent">${dev.dev_grade || 'A'}</span>
            <span class="text-ink font-medium">${dev.dev_score || 0}</span>
          </div>
        </td>
        <td class="px-4 py-3 whitespace-nowrap font-mono text-xs text-muted">
          ${dev.archetype ? `<span class="inline-flex items-center rounded-full border border-line/80 bg-surface/50 px-2 py-0.5 text-[10px] text-ink">${esc(dev.archetype)}</span>` : '—'}
        </td>
        <td class="px-4 py-3 whitespace-nowrap font-mono text-xs text-muted">
          ${dev.primary_language ? esc(dev.primary_language) : '—'}
        </td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          <span class="inline-flex items-center gap-1 rounded-full bg-lime/15 border border-lime/30 px-2.5 py-1 font-mono text-xs font-bold text-limeink">
            ${icon('flame', 'w-3 h-3 text-limeink')} ${full(dev.check_count)}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  // Attach click listener to table rows
  tableBody.querySelectorAll('[data-scan-login]').forEach((row) => {
    row.addEventListener('click', () => {
      const login = row.getAttribute('data-scan-login');
      if (login && _onOpenDossierCallback) {
        closeLeaderboardModal();
        _onOpenDossierCallback(login);
      }
    });
  });
}
