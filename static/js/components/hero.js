/**
 * Hero Section Component
 * Search input, URL support, recent scans dropdown, quick picks, and keyboard shortcuts dock.
 */

import { getHistory, clearHistory, addHistory } from '../state.js';
import { parseTarget, avatarUrl } from '../utils.js';

export function initHero({ onScan }) {
  const form = document.getElementById('searchForm');
  const input = document.getElementById('searchInput');
  const errEl = document.getElementById('searchError');
  const dropdown = document.getElementById('searchDropdown');
  const historyList = document.getElementById('historyList');
  const clearBtn = document.getElementById('historyClearBtn');
  const quickPicks = document.querySelectorAll('[data-quickpick]');

  // Form submit
  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      triggerScan(input.value);
    });
  }

  // Focus & blur history dropdown
  if (input && dropdown) {
    input.addEventListener('focus', () => {
      renderHistory();
      dropdown.classList.remove('hidden');
    });

    document.addEventListener('mousedown', (e) => {
      const wrap = document.getElementById('searchWrapper');
      if (wrap && !wrap.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') dropdown.classList.add('hidden');
    });
  }

  // Clear history
  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearHistory();
      renderHistory();
    });
  }

  // Quick picks
  quickPicks.forEach(btn => {
    btn.addEventListener('click', () => {
      const login = btn.getAttribute('data-quickpick');
      if (login) triggerScan(login);
    });
  });

  function triggerScan(raw) {
    const login = parseTarget(raw);
    if (!login) {
      if (errEl) {
        errEl.textContent = 'Enter a valid GitHub username or profile URL.';
        errEl.classList.remove('hidden');
      }
      return;
    }
    if (errEl) errEl.classList.add('hidden');
    if (dropdown) dropdown.classList.add('hidden');
    if (input) input.value = login;
    addHistory(login);
    onScan(login);
  }

  function renderHistory() {
    if (!historyList) return;
    const items = getHistory();
    if (!items.length) {
      historyList.innerHTML = '<p class="px-4 py-5 text-center text-xs text-muted">No recent scans. Past targets will appear here.</p>';
      return;
    }

    historyList.innerHTML = items.map(login => `
      <li>
        <button type="button" data-history-login="${login}"
          class="group flex w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-150 hover:bg-raised focus:bg-raised focus:outline-none">
          <img src="${avatarUrl(login, 52)}" alt="" class="h-6 w-6 rounded-full bg-raised object-cover shrink-0" />
          <span class="flex-1 font-mono text-sm text-ink truncate">@${login}</span>
          <span class="font-mono text-[11px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">Scan &rarr;</span>
        </button>
      </li>
    `).join('');

    historyList.querySelectorAll('[data-history-login]').forEach(btn => {
      btn.addEventListener('click', () => {
        const login = btn.getAttribute('data-history-login');
        if (login) triggerScan(login);
      });
    });
  }
}
