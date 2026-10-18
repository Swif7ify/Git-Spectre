/**
 * Modals & Action Dock Component
 * API Vault, Dual Compare modal, Batch Screener modal, GitHub Wrapped modal, and Action Dock.
 */

import { getToken, setToken, clearToken } from '../state.js';
import { parseTarget, showToast, compact, full, avatarUrl, esc, icon } from '../utils.js';
import { updateVaultStatus, refreshRateLimit } from './nav.js';
import { batchAnalyze } from '../api.js';
import { mountModalTemplates } from './modalTemplates.js';

export function initModals({ onRunCompare, onOpenDossier, onExportPdf, onShareCard, onCopyBadge, onOpenWrapped }) {
  mountModalTemplates();

  // ── Setup Action Dock ──
  const dock = document.getElementById('actionDock');
  const btnDockPdf = document.getElementById('dockBtnPdf');
  const btnDockCard = document.getElementById('dockBtnCard');
  const btnDockBadge = document.getElementById('dockBtnBadge');
  const btnDockWrapped = document.getElementById('dockBtnWrapped');

  if (btnDockPdf) btnDockPdf.addEventListener('click', onExportPdf);
  if (btnDockCard) btnDockCard.addEventListener('click', onShareCard);
  if (btnDockBadge) btnDockBadge.addEventListener('click', onCopyBadge);
  if (btnDockWrapped) btnDockWrapped.addEventListener('click', () => onOpenWrapped ? onOpenWrapped() : openWrappedModal());

  // ── Global Modal Close Buttons ──
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close-modal');
      closeModal(modalId);
    });
  });

  // Close modals on clicking background backdrop
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.add('hidden');
      }
    });
  });

  // ── 1. API Vault Modal ──
  const vaultModal = document.getElementById('vaultModal');
  const tokenInput = document.getElementById('vaultTokenInput');
  const tokenToggle = document.getElementById('vaultTokenToggle');
  const tokenSave = document.getElementById('vaultSaveBtn');
  const tokenPurge = document.getElementById('vaultPurgeBtn');
  const tokenError = document.getElementById('vaultError');
  const tokenStatusText = document.getElementById('vaultStatusText');
  const tokenStatusLimit = document.getElementById('vaultStatusLimit');

  if (tokenToggle && tokenInput) {
    tokenToggle.addEventListener('click', () => {
      tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
      tokenToggle.innerHTML = tokenInput.type === 'password' ? icon('eye', 'w-4 h-4') : icon('eye-off', 'w-4 h-4');
    });
  }

  if (tokenSave && tokenInput) {
    tokenSave.addEventListener('click', (e) => {
      e.preventDefault();
      const val = tokenInput.value.trim();
      if (!val) {
        if (tokenError) tokenError.textContent = 'Token cannot be empty.';
        return;
      }
      setToken(val);
      updateVaultStatus();
      refreshRateLimit();
      closeModal('vaultModal');
      showToast('Personal Access Token saved', 'key');
    });
  }

  if (tokenPurge) {
    tokenPurge.addEventListener('click', (e) => {
      e.preventDefault();
      clearToken();
      if (tokenInput) tokenInput.value = '';
      updateVaultStatus();
      refreshRateLimit();
      closeModal('vaultModal');
      showToast('Token cleared from local storage', 'trash');
    });
  }

  // ── 2. Compare Modal ──
  const compareForm = document.getElementById('compareForm');
  const inputA = document.getElementById('compareInputA');
  const inputB = document.getElementById('compareInputB');
  const compareError = document.getElementById('compareError');

  if (compareForm) {
    compareForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const a = parseTarget(inputA?.value || '');
      const b = parseTarget(inputB?.value || '');

      if (!a || !b) {
        if (compareError) compareError.textContent = 'Both targets must be valid GitHub handles or profile URLs.';
        return;
      }
      if (a.toLowerCase() === b.toLowerCase()) {
        if (compareError) compareError.textContent = 'Please choose two different developer handles.';
        return;
      }

      if (compareError) compareError.textContent = '';
      closeModal('compareModal');
      onRunCompare(a, b);
    });
  }

  // ── 3. Batch Screener Modal ──
  const batchForm = document.getElementById('batchForm');
  const batchText = document.getElementById('batchTextarea');
  const batchError = document.getElementById('batchError');
  const batchRunBtn = document.getElementById('batchRunBtn');
  const batchFormView = document.getElementById('batchFormView');
  const batchResultsView = document.getElementById('batchResultsView');
  const batchTableBody = document.getElementById('batchTableBody');
  const batchBackBtn = document.getElementById('batchBackBtn');

  if (batchForm && batchText) {
    batchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const lines = batchText.value.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
      const logins = Array.from(new Set(lines.map(parseTarget).filter(Boolean)));

      if (!logins.length) {
        if (batchError) batchError.textContent = 'Please specify at least one username or profile URL.';
        return;
      }
      if (logins.length > 10) {
        if (batchError) batchError.textContent = 'The batch screener supports a maximum of 10 profiles at once.';
        return;
      }

      if (batchError) batchError.textContent = '';
      batchRunBtn.disabled = true;
      batchRunBtn.textContent = `SCANNING ${logins.length} TARGETS…`;

      try {
        const token = getToken();
        const results = await batchAnalyze(logins, token);
        renderBatchTable(results);
        if (batchFormView) batchFormView.classList.add('hidden');
        if (batchResultsView) batchResultsView.classList.remove('hidden');
      } catch (err) {
        if (batchError) batchError.textContent = `Error: ${err.message}`;
      } finally {
        batchRunBtn.disabled = false;
        batchRunBtn.textContent = 'INITIATE BATCH SCAN';
      }
    });
  }

  if (batchBackBtn) {
    batchBackBtn.addEventListener('click', () => {
      if (batchResultsView) batchResultsView.classList.add('hidden');
      if (batchFormView) batchFormView.classList.remove('hidden');
    });
  }

  function getBatchGradeBadge(grade) {
    const g = String(grade || 'E').toUpperCase();
    let color = 'bg-raised text-muted border-line';
    if (g.startsWith('S')) color = 'bg-lime/15 text-limeink border-lime/30';
    else if (g === 'A') color = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    else if (g === 'B') color = 'bg-accent/15 text-accent border-accent/30';
    else if (g === 'C') color = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    else if (g === 'D') color = 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    return `<span class="inline-flex items-center justify-center rounded px-1.5 py-0.5 font-mono text-[10px] font-bold border leading-none shrink-0 ${color}">${esc(g)}</span>`;
  }

  function renderBatchTable(results) {
    if (!batchTableBody) return;
    batchTableBody.innerHTML = results.map((r, i) => {
      if (r.error) {
        return `
          <tr class="border-b border-line text-xs font-mono text-danger">
            <td class="px-4 py-3 text-center">${i + 1}</td>
            <td colspan="6" class="px-4 py-3">@${esc(r.username)}: ${esc(r.error)}</td>
          </tr>
        `;
      }

      return `
        <tr data-batch-login="${esc(r.username)}"
          class="group cursor-pointer border-b border-line transition-colors hover:bg-raised text-xs">
          <td class="px-4 py-3 font-mono text-center whitespace-nowrap ${i === 0 ? 'text-limeink font-bold' : 'text-muted'}">${i + 1}</td>
          <td class="px-4 py-3 min-w-[170px]">
            <div class="flex items-center gap-3">
              <img src="${avatarUrl(r.username, 50)}" alt="" class="h-7 w-7 rounded-full object-cover shrink-0 ring-1 ring-line" />
              <div class="min-w-0">
                <p class="font-medium text-ink truncate">${esc(r.name || r.username)}</p>
                <p class="font-mono text-[11px] text-muted truncate">@${esc(r.username)}</p>
              </div>
            </div>
          </td>
          <td class="px-4 py-3 font-mono whitespace-nowrap">
            <div class="inline-flex items-center gap-2">
              <span class="font-bold text-ink text-sm tabular-nums">${r.score}</span>
              ${getBatchGradeBadge(r.grade)}
            </div>
          </td>
          <td class="px-4 py-3 font-mono text-[11px] text-muted whitespace-nowrap">${esc(r.archetype || '—')}</td>
          <td class="px-4 py-3 font-mono text-[11px] text-ink whitespace-nowrap">${esc(r.top_language || 'N/A')}</td>
          <td class="px-4 py-3 text-right font-mono text-ink whitespace-nowrap">${compact(r.total_stars || 0)}</td>
          <td class="px-4 py-3 text-right font-mono text-ink whitespace-nowrap">${compact(r.followers || 0)}</td>
        </tr>
      `;
    }).join('');

    batchTableBody.querySelectorAll('[data-batch-login]').forEach(row => {
      row.addEventListener('click', () => {
        const login = row.getAttribute('data-batch-login');
        if (login) {
          closeModal('batchModal');
          onOpenDossier(login);
        }
      });
    });
  }

  // ── 4. Wrapped Modal ──
  const wrappedShareBtn = document.getElementById('wrappedShareBtn');
  if (wrappedShareBtn) {
    wrappedShareBtn.addEventListener('click', onShareCard);
  }
}

export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');

  // Modal-specific hydration
  if (id === 'vaultModal') {
    const token = getToken();
    const tokenInput = document.getElementById('vaultTokenInput');
    const tokenStatusText = document.getElementById('vaultStatusText');
    const tokenStatusLimit = document.getElementById('vaultStatusLimit');
    if (tokenInput) tokenInput.value = token;
    if (tokenStatusText) tokenStatusText.textContent = token ? 'Token active' : 'No token stored';
    if (tokenStatusLimit) tokenStatusLimit.textContent = token ? '5,000 req/hr' : '60 req/hr';
  }
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

export function openWrappedModal(dossier) {
  const modal = document.getElementById('wrappedModal');
  if (!modal) return;

  const summary = dossier?.profile || {};
  const wrapped = dossier?.wrapped || {};
  const streaks = dossier?.streaks || {};

  const nameEl = document.getElementById('wrappedName');
  const loginEl = document.getElementById('wrappedLogin');
  const avatarEl = document.getElementById('wrappedAvatar');
  const commitsEl = document.getElementById('wrappedCommits');
  const biggestRepoEl = document.getElementById('wrappedBiggestRepo');
  const tilesContainer = document.getElementById('wrappedTilesContainer');

  const biggestName = typeof wrapped.biggest_repo === 'object' ? (wrapped.biggest_repo?.name || '—') : (wrapped.biggest_repo || '—');
  const biggestStars = typeof wrapped.biggest_repo === 'object' ? (wrapped.biggest_repo?.stars || 0) : (wrapped.biggest_repo_stars || 0);
  const totalCommits = wrapped.year_commits ?? wrapped.commits_this_year ?? wrapped.commits ?? 0;
  const bestMo = typeof wrapped.best_month === 'object' ? wrapped.best_month?.label : (wrapped.best_month || wrapped.peak_month || 'N/A');

  if (nameEl) nameEl.textContent = summary.name || summary.login || '';
  if (loginEl) loginEl.textContent = `@${summary.login || ''}`;
  if (avatarEl) avatarEl.src = avatarUrl(summary.login, 120);
  if (commitsEl) commitsEl.textContent = full(totalCommits);
  if (biggestRepoEl) biggestRepoEl.textContent = `${biggestName} ${biggestStars ? `(${compact(biggestStars)} stars)` : ''}`;

  const tiles = [
    { label: 'Top language', value: wrapped.top_language || (dossier?.languages ? Object.keys(dossier.languages)[0] : 'N/A') },
    { label: 'Longest streak', value: `${streaks.longest || wrapped.longest_streak || 0}d` },
    { label: 'New repos', value: String(wrapped.new_repos_year ?? wrapped.new_repos ?? 0) },
    { label: 'Peak month', value: bestMo },
    { label: 'PR merge rate', value: `${dossier?.pr_merge_rate ?? wrapped.pr_merge_rate ?? 0}%` },
    { label: 'Account age', value: wrapped.age_label || `${wrapped.years_on_github ?? 1} yrs` }
  ];

  if (tilesContainer) {
    tilesContainer.innerHTML = tiles.map(t => `
      <div class="rounded-2xl bg-black/25 p-4 backdrop-blur border border-white/10">
        <p class="text-xs text-white/70 font-mono">${esc(t.label)}</p>
        <p class="mt-1 font-mono text-xl font-bold text-white truncate">${esc(t.value)}</p>
      </div>
    `).join('');
  }

  // Spawn confetti particles
  spawnConfetti();
  modal.classList.remove('hidden');
}

function spawnConfetti() {
  const container = document.getElementById('wrappedConfetti');
  if (!container) return;
  container.innerHTML = '';
  const colors = ['#C6F432', '#8B6CFF', '#F43F5E', '#60A5FA', '#FFFFFF'];
  for (let i = 0; i < 35; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = `${Math.random() * 100}%`;
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDuration = `${1.8 + Math.random() * 2}s`;
    el.style.animationDelay = `${Math.random() * 1.5}s`;
    container.appendChild(el);
  }
}
