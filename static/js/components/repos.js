/**
 * Top Repositories Component
 * Grid of repository cards with health badges, topics, stars, forks, issues, and language dots.
 */

import { esc, safeUrl, compact, getLangColor, formatDate, icon } from '../utils.js';

export function getRepoHealth(repo) {
  if (repo.archived) {
    return { label: 'Archived', dot: 'bg-danger', text: 'text-danger' };
  }
  const dateStr = repo.pushed_at || repo.updated_at;
  if (!dateStr) return { label: 'Active', dot: 'bg-ok', text: 'text-ok' };

  const daysAgo = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 90) {
    return { label: 'Active', dot: 'bg-ok', text: 'text-ok' };
  }
  return { label: 'Stale', dot: 'bg-warn', text: 'text-warn' };
}

export function renderRepos(dossier) {
  const container = document.getElementById('reposContainer');
  if (!container) return;

  const repos = dossier.top_repos || [];
  const owner = dossier.profile?.login || '';

  if (!repos.length) {
    container.innerHTML = '<p class="text-sm text-muted font-mono py-8 text-center">No public repositories found</p>';
    return;
  }

  container.innerHTML = `
    <ul class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      ${repos.map(r => {
        const h = getRepoHealth(r);
        const lang = r.language || 'Plain text';
        const langColor = getLangColor(lang);
        const url = safeUrl(r.html_url || `https://github.com/${owner}/${r.name}`);

        return `
          <li>
            <a href="${url}" target="_blank" rel="noreferrer"
              class="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-all duration-150 hover:border-accent/60 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-accent">
              
              <!-- Header -->
              <div class="flex items-start justify-between gap-3">
                <h3 class="flex min-w-0 items-center gap-1.5 font-mono text-[14px] font-semibold text-accent">
                  <span class="truncate">${esc(r.name)}</span>
                  <span class="text-muted group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
                </h3>
                <span class="flex shrink-0 items-center gap-1.5 text-[11px] font-medium ${h.text}">
                  <span class="h-1.5 w-1.5 rounded-full ${h.dot}"></span>
                  ${h.label}
                </span>
              </div>

              <!-- Description -->
              <p class="mt-2 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-muted">
                ${esc(r.description || 'No description provided')}
              </p>

              <!-- Topic tags -->
              <ul class="mt-3 flex min-h-[22px] flex-wrap gap-1.5">
                ${(r.topics || []).slice(0, 4).map(t => `
                  <li class="rounded-md bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent font-medium">
                    ${esc(t)}
                  </li>
                `).join('')}
              </ul>

              <!-- Metrics -->
              <div class="mb-4 mt-4 flex items-center gap-4 font-mono text-xs tabular-nums text-ink">
                <span class="flex items-center gap-1 text-yellow-400">
                  ${icon('star', 'w-3.5 h-3.5 text-yellow-400')} ${compact(r.stargazers_count ?? r.stars ?? 0)}
                </span>
                <span class="flex items-center gap-1 text-muted">
                  ${icon('fork', 'w-3.5 h-3.5 text-muted')} ${compact(r.forks_count ?? r.forks ?? 0)}
                </span>
                <span class="flex items-center gap-1 text-muted">
                  ${icon('activity', 'w-3.5 h-3.5 text-muted')} ${r.open_issues_count ?? r.issues ?? 0}
                </span>
              </div>

              <!-- Footer -->
              <div class="mt-auto flex items-center gap-3 border-t border-line pt-3 text-[11px] text-muted font-mono">
                <span class="flex items-center gap-1.5 text-ink">
                  <span class="h-2 w-2 rounded-full" style="background:${langColor}"></span>
                  ${esc(lang)}
                </span>
                <span>${compact(r.size || 0)} KB</span>
                <span class="ml-auto">${formatDate(r.pushed_at || r.updated_at)}</span>
              </div>
            </a>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}
