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

export function showScan(target) {
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
