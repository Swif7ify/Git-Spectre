/**
 * Dossier Skeletons Component
 * Displays futuristic, threat-intel skeleton cards while deep analysis is running in parallel.
 */

export function renderDossierSkeletons() {
  const explorer = document.getElementById('explorerPanelsContainer');
  const gamification = document.getElementById('gamificationContainer');
  const activity = document.getElementById('activityContainer');
  const radar = document.getElementById('radarDnaContainer');
  const quality = document.getElementById('codeQualityContainer');
  const repos = document.getElementById('reposContainer');

  const card = (h = 'h-32') => `
    <div class="rounded-2xl border border-line/60 bg-surface/30 p-5 backdrop-blur-sm animate-pulse ${h}">
      <div class="h-4 w-28 rounded bg-raised mb-3"></div>
      <div class="space-y-2">
        <div class="h-3 w-full rounded bg-raised/50"></div>
        <div class="h-3 w-3/4 rounded bg-raised/40"></div>
      </div>
    </div>
  `;

  if (explorer) {
    explorer.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        ${card('h-28')}${card('h-28')}${card('h-28')}
      </div>
    `;
  }

  if (gamification) {
    gamification.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${card('h-44')}${card('h-44')}
      </div>
    `;
  }

  if (activity) {
    activity.innerHTML = `
      <div class="rounded-2xl border border-line/60 bg-surface/30 p-6 animate-pulse space-y-4">
        <div class="flex items-center justify-between">
          <div class="h-4 w-40 rounded bg-raised"></div>
          <div class="h-3 w-20 rounded bg-raised/50"></div>
        </div>
        <div class="h-28 w-full rounded bg-raised/30"></div>
      </div>
    `;
  }

  if (radar) {
    radar.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${card('h-60')}${card('h-60')}
      </div>
    `;
  }

  if (quality) {
    quality.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        ${card('h-40')}${card('h-40')}${card('h-40')}
      </div>
    `;
  }

  if (repos) {
    repos.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${card('h-36')}${card('h-36')}${card('h-36')}${card('h-36')}
      </div>
    `;
  }
}
