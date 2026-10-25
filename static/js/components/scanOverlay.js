/**
 * Scan Overlay Component
 * Threat-intel scanning animation with radar sweep, blips, step progression, and progress bar.
 */

import { icon as getIconSvg } from '../utils.js';

const SCAN_STEPS = [
  'Resolving identity',
  'Fetching repositories',
  'Streaming public events',
  'Collecting gists',
  'Parsing contribution calendar',
  'Computing Developer Score™'
];

let _stepInterval = null;

function ensureScanOverlay() {
  if (document.getElementById('scanOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'scanOverlay';
  overlay.className = 'hidden fixed inset-0 z-[60] flex items-center justify-center bg-canvas/95 px-6 backdrop-blur-md';
  overlay.setAttribute('role', 'status');
  overlay.innerHTML = `
    <div class="flex w-full max-w-2xl flex-col items-center gap-10 md:flex-row md:items-center">
      <div class="relative h-56 w-56 shrink-0" aria-hidden="true">
        <div class="absolute inset-0 rounded-full border border-line"></div>
        <div class="absolute inset-6 rounded-full border border-line"></div>
        <div class="absolute inset-14 rounded-full border border-line"></div>
        <div class="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-line"></div>
        <div class="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-line"></div>
        <div class="absolute inset-0 rounded-full animate-radar-sweep" style="background: conic-gradient(from 0deg, rgb(var(--accent) / 0.5), transparent 75deg);"></div>
        <div class="absolute inset-0 rounded-full border border-accent animate-radar-pulse"></div>
        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center">
          <img src="/static/icon.svg" class="h-6 w-6 object-contain drop-shadow-[0_0_8px_rgb(var(--accent))]" alt="" />
        </div>
      </div>
      <div class="w-full flex-1 font-mono">
        <p class="text-sm text-muted">
          <span class="text-lime font-bold">&gt;</span> Initiating deep scan on:
          <span id="scanTargetText" class="text-ink font-bold"></span>
          <span class="inline-block h-3.5 w-1.5 translate-y-0.5 bg-accent animate-pulse ml-0.5"></span>
        </p>
        <ol id="scanStepsList" class="mt-5 space-y-2.5"></ol>
        <div class="mt-6 flex items-center gap-3">
          <div class="h-1 flex-1 overflow-hidden rounded-full bg-raised">
            <div id="scanProgressBar" class="h-full rounded-full bg-accent transition-all duration-300" style="width: 10%"></div>
          </div>
          <span id="scanProgressPct" class="w-10 text-right text-xs tabular-nums text-muted font-mono">10%</span>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

export function showScan(target) {
  ensureScanOverlay();
  const overlay = document.getElementById('scanOverlay');
  const targetLabel = document.getElementById('scanTargetText');
  const stepsList = document.getElementById('scanStepsList');
  const progressBar = document.getElementById('scanProgressBar');
  const progressPct = document.getElementById('scanProgressPct');

  if (targetLabel) targetLabel.textContent = target;
  if (overlay) overlay.classList.remove('hidden');

  let currentStep = 0;

  function updateSteps(stepIdx) {
    if (!stepsList) return;
    stepsList.innerHTML = SCAN_STEPS.map((step, i) => {
      let icon = '<span class="h-1.5 w-1.5 rounded-full bg-faint"></span>';
      let tone = 'text-faint';

      if (i < stepIdx) {
        icon = '<span class="text-lime flex items-center">' + getIconSvg('check', 'w-3.5 h-3.5') + '</span>';
        tone = 'text-muted';
      } else if (i === stepIdx) {
        icon = '<span class="h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin inline-block"></span>';
        tone = 'text-ink font-medium';
      }

      return `
        <li class="flex items-center gap-3 text-xs transition-colors duration-150 ${tone}">
          <span class="grid h-4 w-4 place-items-center">${icon}</span>
          <span>${step}</span>
        </li>
      `;
    }).join('');

    const pct = Math.min(100, Math.round(((stepIdx + 1) / SCAN_STEPS.length) * 100));
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressPct) progressPct.textContent = `${pct}%`;
  }

  updateSteps(0);
  clearInterval(_stepInterval);
  _stepInterval = setInterval(() => {
    currentStep++;
    if (currentStep < SCAN_STEPS.length) {
      updateSteps(currentStep);
    } else {
      clearInterval(_stepInterval);
    }
  }, 350);
}

export function hideScan() {
  clearInterval(_stepInterval);
  const overlay = document.getElementById('scanOverlay');
  if (overlay) overlay.classList.add('hidden');
}
