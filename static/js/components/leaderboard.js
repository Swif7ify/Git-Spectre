/**
 * Leaderboard Page View Component
 * Dedicated page for Global Developer Rankings across Daily, Monthly, Yearly, and All-Time windows.
 * Strictly uses SVG vector icons and crisp, professional typography (no emojis or AI slop text).
 */

import { getLeaderboard } from '../api.js';
import { esc, avatarUrl, full } from '../utils.js';

let _activePeriod = 'daily';
let _activeLanguage = '';
let _searchQuery = '';
let _onOpenDossierCallback = null;
let _onBackHomeCallback = null;
let _debounceTimer = null;

// Clean SVG icon helpers (zero emojis)
const ICONS = {
  trophy: `<svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v3h10v-3c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
  flame: `<svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  arrowRight: `<svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`,
  arrowLeft: `<svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
  search: `<svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  star: `<svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" class="h-3 w-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
};

export function renderLeaderboardView({ onOpenDossier, onBackHome }) {
  _onOpenDossierCallback = onOpenDossier;
  _onBackHomeCallback = onBackHome;

  const container = document.getElementById('leaderboardViewContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Breadcrumb & Page Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-6">
        <div>
          <button type="button" id="lbBackBtn" class="inline-flex items-center gap-1.5 text-xs font-mono text-muted hover:text-ink transition-colors mb-2">
            ${ICONS.arrowLeft}
            <span>Back to Scanner</span>
          </button>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">Developer Rankings</h1>
            <span class="rounded-full border border-lime/30 bg-lime/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-limeink">Community Verified</span>
          </div>
          <p class="mt-1 text-xs sm:text-sm text-muted">GitHub developer profiles ranked by verified community checks and popularity interest.</p>
        </div>

        <!-- Telemetry Stats Pill -->
        <div class="flex items-center gap-4 rounded-xl border border-line bg-surface/60 px-4 py-2.5 text-xs font-mono">
          <div>
            <div class="text-[10px] uppercase text-muted">Total Profiles</div>
            <div id="lbHeaderTotal" class="text-sm font-semibold text-ink">—</div>
          </div>
          <div class="h-6 w-px bg-line/60"></div>
          <div>
            <div class="text-[10px] uppercase text-muted">Anti-Spam</div>
            <div class="text-sm font-semibold text-limeink flex items-center gap-1">
              ${ICONS.shield} Active
            </div>
          </div>
        </div>
      </div>

      <!-- Controls Row: Timeframe Switcher, Search, Language Dropdown -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <!-- Segmented Timeframe Switcher -->
        <div class="inline-flex items-center rounded-xl border border-line bg-surface p-1 shadow-sm">
          <button type="button" data-period="daily" class="lb-tab-btn rounded-lg px-3.5 py-1.5 font-mono text-xs font-medium transition-all">Today</button>
          <button type="button" data-period="monthly" class="lb-tab-btn rounded-lg px-3.5 py-1.5 font-mono text-xs font-medium transition-all">This Month</button>
          <button type="button" data-period="yearly" class="lb-tab-btn rounded-lg px-3.5 py-1.5 font-mono text-xs font-medium transition-all">This Year</button>
          <button type="button" data-period="all" class="lb-tab-btn rounded-lg px-3.5 py-1.5 font-mono text-xs font-medium transition-all">All-Time</button>
        </div>

        <!-- Search & Filter Controls -->
        <div class="flex items-center gap-2">
          <div class="relative w-full sm:w-56">
            <input id="lbSearchInput" type="text" placeholder="Search developer or bio..." autocomplete="off" spellcheck="false" class="w-full rounded-xl border border-line bg-surface px-3 py-2 pl-8 font-mono text-xs text-ink outline-none focus:border-accent transition-colors" />
            <span class="absolute left-2.5 top-2.5 text-muted pointer-events-none">${ICONS.search}</span>
          </div>
          <select id="lbLangSelect" class="rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs text-ink outline-none focus:border-accent transition-colors">
            <option value="">All Languages</option>
            <option value="Python">Python</option>
            <option value="TypeScript">TypeScript</option>
            <option value="JavaScript">JavaScript</option>
            <option value="Rust">Rust</option>
            <option value="Go">Go</option>
            <option value="C++">C++</option>
            <option value="Java">Java</option>
            <option value="C">C</option>
            <option value="Ruby">Ruby</option>
          </select>
        </div>
      </div>

      <!-- Loading State Indicator -->
      <div id="lbLoading" class="hidden py-8 text-center font-mono text-xs text-muted">
        <div class="inline-flex items-center gap-2">
          <svg class="h-4 w-4 animate-spin text-lime" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <span>Loading developer rankings...</span>
        </div>
      </div>

      <!-- Top 3 Podium Area -->
      <div id="lbPodiumContainer" class="hidden"></div>

      <!-- Full Ranked Table -->
      <div class="rounded-2xl border border-line bg-surface/50 overflow-hidden shadow-sm">
        <div class="scroll-thin overflow-x-auto">
          <table class="w-full min-w-[700px] text-left text-xs font-mono">
            <thead>
              <tr class="border-b border-line bg-surface/80 text-muted uppercase text-[10px] tracking-wider">
                <th class="px-5 py-3 w-16 text-center">Rank</th>
                <th class="px-5 py-3 min-w-[200px]">Developer</th>
                <th class="px-5 py-3 whitespace-nowrap">Developer Score</th>
                <th class="px-5 py-3 whitespace-nowrap">Archetype</th>
                <th class="px-5 py-3 whitespace-nowrap">Primary Stack</th>
                <th class="px-5 py-3 text-right whitespace-nowrap">Verified Checks</th>
                <th class="px-5 py-3 text-right w-24">Action</th>
              </tr>
            </thead>
            <tbody id="lbTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  const backBtn = document.getElementById('lbBackBtn');
  if (backBtn && _onBackHomeCallback) {
    backBtn.addEventListener('click', _onBackHomeCallback);
  }

  const tabBtns = document.querySelectorAll('.lb-tab-btn');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const period = btn.getAttribute('data-period');
      if (period && period !== _activePeriod) {
        _activePeriod = period;
        updateTabStyles();
        fetchAndRenderRankings();
      }
    });
  });

  const searchInput = document.getElementById('lbSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => {
        _searchQuery = e.target.value.trim();
        fetchAndRenderRankings();
      }, 250);
    });
  }

  const langSelect = document.getElementById('lbLangSelect');
  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      _activeLanguage = e.target.value;
      fetchAndRenderRankings();
    });
  }

  updateTabStyles();
  fetchAndRenderRankings();
}

function updateTabStyles() {
  const tabBtns = document.querySelectorAll('.lb-tab-btn');
  tabBtns.forEach((btn) => {
    const period = btn.getAttribute('data-period');
    const isActive = period === _activePeriod;
    if (isActive) {
      btn.className = 'lb-tab-btn rounded-lg bg-lime px-3.5 py-1.5 font-mono text-xs font-bold text-onlime shadow-sm transition-all';
    } else {
      btn.className = 'lb-tab-btn rounded-lg px-3.5 py-1.5 font-mono text-xs font-medium text-muted hover:bg-raised hover:text-ink transition-colors';
    }
  });
}

export async function fetchAndRenderRankings() {
  const loading = document.getElementById('lbLoading');
  const podium = document.getElementById('lbPodiumContainer');
  const tableBody = document.getElementById('lbTableBody');
  const headerTotal = document.getElementById('lbHeaderTotal');

  if (loading) loading.classList.remove('hidden');

  try {
    const data = await getLeaderboard({
      period: _activePeriod,
      limit: 50,
      language: _activeLanguage,
      q: _searchQuery,
    });

    const list = data.leaderboard || data.developers || [];
    if (headerTotal) {
      headerTotal.textContent = `${list.length}`;
    }

    renderPodium(podium, list.slice(0, 3));
    renderTable(tableBody, list);
  } catch (err) {
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-xs text-danger font-mono">Failed to load rankings: ${esc(err.message)}</td></tr>`;
    }
  } finally {
    if (loading) loading.classList.add('hidden');
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

  const first = topThree[0] || null;
  const second = topThree[1] || null;
  const third = topThree[2] || null;

  const cards = [
    { dev: second, rank: 2, rankLabel: '02', border: 'border-slate-400/40', accentText: 'text-slate-400', bg: 'bg-surface hover:border-slate-300/60', order: 'order-2 sm:order-1' },
    { dev: first, rank: 1, rankLabel: '01', border: 'border-amber-400/50 ring-1 ring-amber-400/20', accentText: 'text-amber-400', bg: 'bg-surface hover:border-amber-400/80', order: 'order-1 sm:order-2' },
    { dev: third, rank: 3, rankLabel: '03', border: 'border-amber-700/40', accentText: 'text-amber-600', bg: 'bg-surface hover:border-amber-600/60', order: 'order-3 sm:order-3' },
  ];

  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6 items-end">
      ${cards.map((c) => {
        if (!c.dev) {
          return `<div class="${c.order} hidden sm:flex h-44 rounded-2xl border border-line/40 bg-surface/20 items-center justify-center opacity-30">
            <span class="font-mono text-xs text-muted">No contender</span>
          </div>`;
        }
        const dev = c.dev;
        const isFirst = c.rank === 1;
        return `
          <div class="${c.order} relative group cursor-pointer overflow-hidden rounded-2xl border ${c.border} ${c.bg} p-5 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5"
               data-scan-login="${esc(dev.login)}">
            <div class="flex items-center justify-between mb-4">
              <span class="inline-flex items-center gap-1.5 font-mono text-xs font-bold ${c.accentText}">
                ${isFirst ? ICONS.trophy : ''}
                <span>#${c.rankLabel}</span>
              </span>
              <span class="inline-flex items-center gap-1.5 rounded-full bg-lime/10 border border-lime/30 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-limeink">
                ${ICONS.flame} ${full(dev.check_count)} checks
              </span>
            </div>

            <div class="flex items-center gap-3.5">
              <div class="relative shrink-0">
                <img src="${avatarUrl(dev.login, 120)}" alt="${esc(dev.login)}" class="h-12 w-12 sm:h-14 sm:w-14 rounded-full border border-line bg-surface object-cover" />
                <span class="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-surface border border-line font-mono text-[9px] font-bold text-ink">
                  ${dev.score_tier || dev.dev_grade || 'A'}
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-semibold text-ink text-sm sm:text-base truncate group-hover:text-accent transition-colors">
                  ${esc(dev.name || dev.login)}
                </div>
                <div class="font-mono text-xs text-muted truncate">@${esc(dev.login)}</div>
                <div class="mt-1 flex items-center gap-2 text-[11px] font-mono text-muted">
                  <span>Score: <b class="text-ink font-semibold">${dev.dev_score || 0}</b></span>
                  ${dev.primary_language ? `<span>· ${esc(dev.primary_language)}</span>` : ''}
                </div>
              </div>
            </div>

            <div class="mt-4 pt-3 border-t border-line/50 flex items-center justify-between text-[11px] font-mono text-muted">
              <span>${dev.archetype_title || dev.archetype || 'Developer'}</span>
              <span class="inline-flex items-center gap-1 text-ink group-hover:text-accent group-hover:translate-x-0.5 transition-all">
                <span>Inspect</span>
                ${ICONS.arrowRight}
              </span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  container.querySelectorAll('[data-scan-login]').forEach((el) => {
    el.addEventListener('click', () => {
      const login = el.getAttribute('data-scan-login');
      if (login && _onOpenDossierCallback) _onOpenDossierCallback(login);
    });
  });
}

function renderTable(tableBody, list) {
  if (!tableBody) return;

  if (!list || list.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="py-16 text-center">
          <div class="mx-auto max-w-sm space-y-2">
            <p class="font-mono text-xs font-semibold uppercase tracking-wider text-ink">No Profiles Found</p>
            <p class="text-xs text-muted">No developer profiles match the selected filter or timeframe. Scan any GitHub profile to rank them here.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = list.map((dev, idx) => {
    const rankNum = dev.rank || (idx + 1);
    const formattedRank = rankNum < 10 ? `0${rankNum}` : `${rankNum}`;
    const rankBadgeClass = rankNum === 1 ? 'text-amber-400 font-bold' : rankNum === 2 ? 'text-slate-300 font-bold' : rankNum === 3 ? 'text-amber-600 font-bold' : 'text-muted';

    return `
      <tr class="group border-b border-line/40 transition-colors hover:bg-raised/60 cursor-pointer" data-scan-login="${esc(dev.login)}">
        <td class="px-5 py-3.5 text-center font-mono text-xs ${rankBadgeClass}">
          ${formattedRank}
        </td>
        <td class="px-5 py-3.5 min-w-[200px]">
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
        <td class="px-5 py-3.5 whitespace-nowrap">
          <div class="flex items-center gap-1.5 font-mono text-xs">
            <span class="rounded bg-surface px-1.5 py-0.5 border border-line text-[10px] font-bold text-accent">${dev.score_tier || dev.dev_grade || 'A'}</span>
            <span class="text-ink font-medium">${dev.dev_score || 0}</span>
          </div>
        </td>
        <td class="px-5 py-3.5 whitespace-nowrap font-mono text-xs text-muted">
          ${dev.archetype_title || dev.archetype ? `<span class="inline-flex items-center rounded-full border border-line bg-surface/50 px-2 py-0.5 text-[10px] text-ink">${esc(dev.archetype_title || dev.archetype)}</span>` : '—'}
        </td>
        <td class="px-5 py-3.5 whitespace-nowrap font-mono text-xs text-muted">
          ${dev.primary_language ? esc(dev.primary_language) : '—'}
        </td>
        <td class="px-5 py-3.5 text-right whitespace-nowrap">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-lime/10 border border-lime/30 px-2.5 py-1 font-mono text-xs font-bold text-limeink">
            ${ICONS.flame} ${full(dev.check_count)}
          </span>
        </td>
        <td class="px-5 py-3.5 text-right whitespace-nowrap">
          <button type="button" class="inline-flex items-center gap-1 text-[11px] font-mono text-muted group-hover:text-ink transition-colors">
            <span>View</span>
            ${ICONS.arrowRight}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tableBody.querySelectorAll('[data-scan-login]').forEach((row) => {
    row.addEventListener('click', () => {
      const login = row.getAttribute('data-scan-login');
      if (login && _onOpenDossierCallback) _onOpenDossierCallback(login);
    });
  });
}
