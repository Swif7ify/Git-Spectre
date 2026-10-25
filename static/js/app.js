/**
 * Git-Spectre Application Controller
 * Bootstraps modules, coordinates view transitions, scans, comparisons, and keyboard shortcuts.
 */

import { analyzeProfile, compareProfiles } from './api.js';
import { appState, getToken, getTheme, applyTheme, toggleTheme } from './state.js';
import { showToast, parseTarget } from './utils.js';

import { initNav, updateThemeIcon } from './components/nav.js';
import { initHero } from './components/hero.js';
import { showScan, hideScan } from './components/scanOverlay.js';
import { renderIdentity } from './components/identity.js';
import { renderExplorer } from './components/explorer.js';
import { renderGamification } from './components/gamification.js';
import { renderActivity } from './components/activity.js';
import { renderRadarDna } from './components/radarDna.js';
import { renderCodeQuality } from './components/codeQuality.js';
import { renderRepos } from './components/repos.js';
import { renderCompareView } from './components/compare.js';
import { initModals, openModal, closeModal, openWrappedModal } from './components/modals.js';
import { exportPdf, exportShareCard, copyBadgeSnippet } from './export.js';
import { initBackground } from './components/background.js';

// View Transition Helper
function setView(view) {
  appState.currentView = view;
  const heroSection = document.getElementById('heroSection');
  const dossierSection = document.getElementById('dossierSection');
  const compareSection = document.getElementById('compareSection');
  const actionDock = document.getElementById('actionDock');

  if (heroSection) heroSection.classList.toggle('hidden', view !== 'hero');
  if (dossierSection) dossierSection.classList.toggle('hidden', view !== 'dossier');
  if (compareSection) compareSection.classList.toggle('hidden', view !== 'compare');
  if (actionDock) actionDock.classList.toggle('hidden', view !== 'dossier');

  if (view === 'dossier') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Main Scan Action
export async function runScan(rawUsername) {
  const username = parseTarget(rawUsername);
  if (!username) return;

  showScan(username);

  try {
    const token = getToken();
    const data = await analyzeProfile(username, token);
    appState.activeDossier = data;

    // Render all modular dossier components
    renderIdentity(data);
    renderExplorer(data);
    renderGamification(data);
    renderActivity(data);
    renderRadarDna(data);
    renderCodeQuality(data);
    renderRepos(data);

    // Update browser URL
    history.pushState(null, '', `/?u=${encodeURIComponent(username)}`);

    // Switch view to dossier
    setView('dossier');
  } catch (err) {
    showToast(`Scan failed: ${err.message}`, 'alert-triangle');
  } finally {
    hideScan();
  }
}

// Dual Compare Action
export async function runCompare(userA, userB) {
  showScan(`${userA} vs ${userB}`);

  try {
    const token = getToken();
    const data = await compareProfiles(userA, userB, token);
    appState.activeCompare = data;

    renderCompareView(data, {
      onBack: () => setView('hero'),
      onOpenDossier: (login) => runScan(login),
    });

    setView('compare');
  } catch (err) {
    showToast(`Comparison failed: ${err.message}`, 'alert-triangle');
  } finally {
    hideScan();
  }
}

// Global Keyboard Shortcuts
function initShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Escape closes any open modal
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
      return;
    }

    // Don't trigger shortcuts if user is typing in an input or textarea
    const active = document.activeElement;
    const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');

    if ((e.ctrlKey || e.metaKey)) {
      const key = e.key.toLowerCase();
      if (key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.focus();
      } else if (key === 'e') {
        e.preventDefault();
        if (appState.activeDossier) exportPdf(appState.activeDossier);
      } else if (key === 'd') {
        e.preventDefault();
        openModal('compareModal');
      } else if (key === 'b') {
        e.preventDefault();
        openModal('batchModal');
      } else if (key === 't') {
        e.preventDefault();
        toggleTheme();
        updateThemeIcon();
      }
    }
  });
}

// Initialize Application
window.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme & initialize telemetry grid canvas background
  applyTheme(getTheme());
  initBackground();

  // Initialize Nav
  initNav({
    onHome: () => setView('hero'),
    onCompare: () => openModal('compareModal'),
    onBatch: () => openModal('batchModal'),
    onVault: () => openModal('vaultModal'),
  });

  // Initialize Hero
  initHero({
    onScan: (login) => runScan(login),
  });

  // Initialize Modals
  initModals({
    onRunCompare: (a, b) => runCompare(a, b),
    onOpenDossier: (login) => runScan(login),
    onExportPdf: () => {
      if (appState.activeDossier) exportPdf(appState.activeDossier);
      else showToast('Scan a profile first', 'alert-triangle');
    },
    onShareCard: () => {
      if (appState.activeDossier) exportShareCard(appState.activeDossier);
      else showToast('Scan a profile first', 'alert-triangle');
    },
    onCopyBadge: () => {
      if (appState.activeDossier?.profile?.login) {
        copyBadgeSnippet(appState.activeDossier.profile.login);
      } else {
        showToast('Scan a profile first', 'alert-triangle');
      }
    },
    onOpenWrapped: () => {
      if (appState.activeDossier) openWrappedModal(appState.activeDossier);
      else showToast('Scan a profile first', 'alert-triangle');
    },
  });

  // Initialize Global Shortcuts
  initShortcuts();

  // URL query parameter check: ?u=username
  const params = new URLSearchParams(window.location.search);
  const u = params.get('u');
  if (u) {
    runScan(u);
  }
});
