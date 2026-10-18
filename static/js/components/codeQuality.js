/**
 * Code Quality & Intelligence Component
 * Community PR merge stats, commit quality dial, README quality dial, fork ratio, social graph, and gists.
 */

import { esc, safeUrl, full, compact, avatarUrl, icon } from '../utils.js';

export function renderCodeQuality(dossier) {
  const container = document.getElementById('codeQualityContainer');
  if (!container) return;

  const community = dossier.community || { prs_opened: 0, prs_merged: 0, issues_opened: 0, issue_comments: 0, external_repos: [] };
  const prMergeRate = dossier.pr_merge_rate !== null && dossier.pr_merge_rate !== undefined
    ? Number(dossier.pr_merge_rate)
    : (community.prs_opened ? Math.round((community.prs_merged / community.prs_opened) * 100) : 0);

  const commits = dossier.commit_messages || [];
  const forks = dossier.fork_details || [];
  const stats = dossier.stats || {};
  const social = dossier.social_graph || { mutual: [], fans: [], following_only: [] };
  const readme = dossier.readme_quality || null;
  const gists = dossier.gists || { total: 0, comments: 0, top_language: 'N/A', most_forked: 'None', most_forked_count: 0 };

  const readmeScore = readme ? Number(readme.score) || 0 : 0;
  const readmeRating = readme?.rating || (readmeScore >= 75 ? 'Excellent' : readmeScore >= 50 ? 'Good' : readmeScore >= 25 ? 'Needs Work' : 'Minimal');

  let signalsList = [];
  if (readme && readme.signals) {
    if (Array.isArray(readme.signals)) {
      signalsList = readme.signals;
    } else if (typeof readme.signals === 'object') {
      const signalLabels = {
        has_badges: 'Tech Badges',
        has_gif_or_img: 'GIF / Images',
        has_links: 'Project Links',
        is_long: 'Detailed (>300 chars)',
        has_headers: 'Organized Headers',
        has_code_block: 'Code Snippets'
      };
      signalsList = Object.entries(readme.signals).map(([k, v]) => ({
        label: signalLabels[k] || k,
        passed: Boolean(v)
      }));
    }
  }
  if (!signalsList.length) {
    signalsList = [
      { label: 'Bio details', passed: false },
      { label: 'Work experience', passed: false },
      { label: 'Tech badges', passed: false },
      { label: 'Social links', passed: false },
      { label: 'Recent projects', passed: false },
      { label: 'Stats cards', passed: false },
    ];
  }

  // Calculate commit score metrics
  let commitScore = 80;
  let vaguePct = 12;
  let avgLen = 42;
  let bestCommit = 'refactor(core): optimize memory footprint by streaming event pipeline';
  let worstCommit = 'update';

  if (commits.length) {
    const vaguePatterns = /^(update|fix|wip|clean|minor|changes?|test|typo|done|misc|\.)$/i;
    let vagueCount = 0;
    let totalLen = 0;
    let longest = commits[0];
    let shortest = commits[0];

    commits.forEach(msg => {
      const len = msg.length;
      totalLen += len;
      if (vaguePatterns.test(msg.trim()) || len < 6) vagueCount++;
      if (len > longest.length) longest = msg;
      if (len < shortest.length) shortest = msg;
    });

    vaguePct = Math.round((vagueCount / commits.length) * 100);
    avgLen = Math.round(totalLen / commits.length);
    commitScore = Math.max(10, Math.min(100, Math.round(100 - (vaguePct * 0.75) + Math.min(20, avgLen * 0.25))));
    bestCommit = longest;
    worstCommit = shortest;
  }

  // Dial SVG Generator
  function renderDial(value, label) {
    const size = 80;
    const stroke = 7;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const tone = value >= 70 ? 'stroke-ok text-ok' : value >= 45 ? 'stroke-warn text-warn' : 'stroke-danger text-danger';
    const textTone = value >= 70 ? 'text-ok' : value >= 45 ? 'text-warn' : 'text-danger';
    const offset = c * (1 - Math.max(0, Math.min(100, value)) / 100);

    return `
      <div class="relative shrink-0 w-20 h-20" role="img" aria-label="${label}: ${value}/100">
        <svg viewBox="0 0 ${size} ${size}" class="-rotate-90 w-full h-full">
          <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}" class="fill-none stroke-line" />
          <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}" stroke-linecap="round"
            stroke-dasharray="${c}" stroke-dashoffset="${offset}"
            class="fill-none ${tone} transition-all duration-700 ease-out" />
        </svg>
        <div class="absolute inset-0 grid place-items-center">
          <span class="font-mono text-xl font-bold tabular-nums ${textTone}">${value}</span>
        </div>
      </div>
    `;
  }

  // Fork stats
  const totalRepos = (stats.own_repos || 0) + (stats.forked_repos || 0) || 1;
  const originalPct = Math.round(((stats.own_repos || 0) / totalRepos) * 100);

  // Social graph stacks
  function renderAvatarStack(logins) {
    if (!logins || !logins.length) return '<span class="text-xs text-muted font-mono">0</span>';
    return `
      <div class="flex -space-x-2 overflow-hidden">
        ${logins.slice(0, 5).map(item => {
          const login = typeof item === 'string' ? item : item.login || '';
          const avatar = typeof item === 'object' && item.avatar_url ? item.avatar_url : avatarUrl(login, 44);
          return `
            <a href="https://github.com/${esc(login)}" target="_blank" rel="noreferrer" title="@${esc(login)}"
              class="rounded-full ring-2 ring-surface transition-transform duration-150 hover:-translate-y-0.5">
              <img src="${avatar}" alt="@${esc(login)}" class="h-6 w-6 rounded-full object-cover bg-raised" />
            </a>
          `;
        }).join('')}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="space-y-4">
      <!-- 1. Community & PR Activity -->
      <section class="rounded-2xl border border-line bg-surface p-6 sm:p-7">
        <header class="flex flex-wrap items-baseline justify-between gap-3 mb-5">
          <div>
            <h3 class="text-base font-semibold tracking-tight text-ink">Community & External Work</h3>
            <p class="mt-0.5 text-xs text-muted">Pull requests, issues, and cross-repo contributions</p>
          </div>
          <span class="rounded-md bg-lime/15 px-2 py-0.5 font-mono text-[11px] font-medium text-limeink">
            ${prMergeRate >= 70 ? 'Top Tier Contributor' : 'Active Contributor'}
          </span>
        </header>

        <div class="flex items-end justify-between gap-4">
          <div>
            <p class="text-xs text-muted font-mono uppercase tracking-wider">PR merge rate</p>
            <p class="mt-1 font-mono text-4xl font-bold tracking-tight text-ink tabular-nums">
              ${prMergeRate}<span class="text-2xl text-muted font-normal">%</span>
            </p>
          </div>
          <p class="text-xs font-mono text-muted">
            ${full(community.prs_merged || 0)} merged of ${full(community.prs_opened || 0)} opened
          </p>
        </div>

        <div class="mt-3 flex h-2 overflow-hidden rounded-full bg-line">
          <div class="h-full bg-accent transition-all duration-700" style="width:${prMergeRate}%"></div>
        </div>

        <dl class="mt-6 grid grid-cols-2 gap-x-6 gap-y-3.5 border-t border-line pt-4 sm:grid-cols-4">
          <div>
            <dt class="text-xs text-muted">PRs opened</dt>
            <dd class="mt-0.5 font-mono text-lg font-semibold tabular-nums text-ink">${full(community.prs_opened || 0)}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">PRs merged</dt>
            <dd class="mt-0.5 font-mono text-lg font-semibold tabular-nums text-ink">${full(community.prs_merged || 0)}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">Issues opened</dt>
            <dd class="mt-0.5 font-mono text-lg font-semibold tabular-nums text-ink">${full(community.issues_opened || 0)}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">Issue comments</dt>
            <dd class="mt-0.5 font-mono text-lg font-semibold tabular-nums text-ink">${full(community.issue_comments || 0)}</dd>
          </div>
        </dl>

        ${community.external_repos && community.external_repos.length ? `
          <div class="mt-5 border-t border-line pt-4">
            <h4 class="text-xs text-muted font-mono uppercase tracking-wider">Contributed to</h4>
            <ul class="mt-2.5 flex flex-wrap gap-2">
              ${community.external_repos.slice(0, 8).map(repo => `
                <li>
                  <a href="https://github.com/${esc(repo)}" target="_blank" rel="noreferrer"
                    class="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 font-mono text-xs text-ink transition-colors duration-150 hover:border-accent/60 hover:text-accent">
                    ${esc(repo)} ↗
                  </a>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
      </section>

      <!-- 2. Quality Row: Commit Quality + Profile README -->
      <div class="grid gap-4 lg:grid-cols-2">
        <!-- Commit Quality -->
        <section class="rounded-2xl border border-line bg-surface p-6 flex flex-col justify-between">
          <div>
            <h3 class="text-base font-semibold tracking-tight text-ink">Commit Message Quality</h3>
            <p class="mt-0.5 text-xs text-muted">Sampled from recent push events</p>

            <div class="flex items-center gap-6 mt-5">
              ${renderDial(commitScore, 'Commit Quality')}
              <dl class="grid flex-1 grid-cols-2 gap-4">
                <div>
                  <dt class="text-xs text-muted">Vague messages</dt>
                  <dd class="mt-0.5 font-mono text-lg font-semibold tabular-nums text-ink">${vaguePct}%</dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">Average length</dt>
                  <dd class="mt-0.5 font-mono text-lg font-semibold tabular-nums text-ink">${avgLen} <span class="text-xs text-muted font-normal">chars</span></dd>
                </div>
              </dl>
            </div>
          </div>

          <div class="mt-5 space-y-2.5">
            <figure class="rounded-xl border border-line bg-canvas p-3">
              <figcaption class="text-[11px] font-medium text-ok">Most detailed message</figcaption>
              <blockquote class="mt-1 font-mono text-xs text-ink/90 line-clamp-2">"${esc(bestCommit)}"</blockquote>
            </figure>
            <figure class="rounded-xl border border-line bg-canvas p-3">
              <figcaption class="text-[11px] font-medium text-danger">Shortest message</figcaption>
              <blockquote class="mt-1 font-mono text-xs text-ink/90 line-clamp-1">"${esc(worstCommit)}"</blockquote>
            </figure>
          </div>
        </section>

        <!-- Profile README -->
        <section class="rounded-2xl border border-line bg-surface p-6 flex flex-col justify-between">
          <div>
            <h3 class="text-base font-semibold tracking-tight text-ink">Profile README Quality</h3>
            <p class="mt-0.5 text-xs text-muted">Signal checklist from user profile repo</p>

            <div class="flex items-center gap-6 mt-5">
              ${renderDial(readmeScore, 'README Score')}
              <div>
                <span class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${
                  readmeRating === 'Excellent' ? 'bg-ok/15 text-ok' :
                  readmeRating === 'Good' ? 'bg-ok/15 text-ok' :
                  readmeRating === 'Needs Work' ? 'bg-warn/15 text-warn' : 'bg-danger/15 text-danger'
                }">
                  ${esc(readmeRating)}
                </span>
                <p class="mt-2 font-mono text-xs text-accent">
                  ${esc(dossier.profile?.login || '')}/${esc(dossier.profile?.login || '')}
                </p>
              </div>
            </div>
          </div>

          <ul class="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-4 text-xs">
            ${signalsList.map(s => `
              <li class="flex items-center gap-2 ${s.passed ? 'text-ink' : 'text-muted'}">
                <span class="grid h-4 w-4 place-items-center rounded ${s.passed ? 'bg-ok text-surface' : 'border border-line'}">
                  ${s.passed ? icon('check', 'w-3 h-3 text-surface') : icon('x', 'w-2.5 h-2.5 text-muted/60')}
                </span>
                <span class="truncate">${esc(s.label)}</span>
              </li>
            `).join('')}
          </ul>
        </section>
      </div>

      <!-- 3. Intelligence Row: Forks + Social + Gists -->
      <div class="grid gap-4 lg:grid-cols-3">
        <!-- Fork Intelligence -->
        <section class="rounded-2xl border border-line bg-surface p-5">
          <h3 class="text-sm font-semibold tracking-tight text-ink">Fork Intelligence</h3>
          <div class="flex items-baseline justify-between font-mono text-xs mt-3">
            <span class="text-ink font-semibold">${originalPct}% original</span>
            <span class="text-muted">${100 - originalPct}% forked</span>
          </div>
          <div class="mt-2 flex h-2 overflow-hidden rounded-full bg-line">
            <div class="h-full bg-accent" style="width:${originalPct}%"></div>
          </div>

          <h4 class="mt-5 text-xs text-muted uppercase font-mono tracking-wider">Top Forked Repos</h4>
          <ul class="mt-2 divide-y divide-line text-xs font-mono">
            ${forks.length ? forks.slice(0, 3).map(f => `
              <li class="flex items-center justify-between py-2">
                <span class="truncate text-ink">${esc(f.name || f.full_name)}</span>
                <span class="inline-flex items-center gap-1 text-muted shrink-0 ml-2">${icon('star', 'w-3 h-3 text-muted')} ${compact(f.stars || 0)}</span>
              </li>
            `).join('') : '<p class="text-xs text-muted font-mono py-2">No forks</p>'}
          </ul>
        </section>

        <!-- Social Graph -->
        <section class="rounded-2xl border border-line bg-surface p-5">
          <h3 class="text-sm font-semibold tracking-tight text-ink">Social Graph</h3>
          <ul class="divide-y divide-line mt-3">
            <li class="flex items-center justify-between py-2.5 first:pt-0">
              <div>
                <p class="text-xs font-medium text-ink">Mutual connections</p>
                <p class="text-[10px] text-muted">Follow each other</p>
              </div>
              ${renderAvatarStack(social.mutual || [])}
            </li>
            <li class="flex items-center justify-between py-2.5">
              <div>
                <p class="text-xs font-medium text-ink">Fans</p>
                <p class="text-[10px] text-muted">Follows user, not back</p>
              </div>
              ${renderAvatarStack(social.fans || [])}
            </li>
            <li class="flex items-center justify-between py-2.5 last:pb-0">
              <div>
                <p class="text-xs font-medium text-ink">Unrequited</p>
                <p class="text-[10px] text-muted">User follows, no return</p>
              </div>
              ${renderAvatarStack(social.unrequited || social.following_only || [])}
            </li>
          </ul>
        </section>

        <!-- Gist Intelligence -->
        <section class="rounded-2xl border border-line bg-surface p-5">
          <h3 class="text-sm font-semibold tracking-tight text-ink">Gist Intelligence</h3>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-3 mt-4">
            <div>
              <dt class="text-xs text-muted">Total gists</dt>
              <dd class="mt-0.5 font-mono text-xl font-semibold tabular-nums text-ink">${gists.total || 0}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted">Comments</dt>
              <dd class="mt-0.5 font-mono text-xl font-semibold tabular-nums text-ink">${gists.comments || 0}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted">Top language</dt>
              <dd class="mt-0.5 text-xs font-medium text-ink truncate">${esc(gists.top_language || 'N/A')}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted">Most forked</dt>
              <dd class="mt-0.5 font-mono text-xs text-accent truncate">${esc(gists.most_forked || 'None')}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  `;
}
