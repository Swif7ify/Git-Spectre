/**
 * Compare View Component
 * Head-to-head comparison page with VS card, metric-by-metric comparison bars, and winner calculation.
 */

import { esc, compact, full, avatarUrl, icon } from '../utils.js';

export function renderCompareView(data, { onBack, onOpenDossier }) {
  const container = document.getElementById('compareViewContainer');
  if (!container) return;

  const a = data.user_a || {};
  const b = data.user_b || {};

  const pa = a.profile || {};
  const pb = b.profile || {};
  const sa = a.score || { total: 0 };
  const sb = b.score || { total: 0 };
  const stA = a.stats || {};
  const stB = b.stats || {};
  const strA = a.streaks || {};
  const strB = b.streaks || {};

  const metrics = [
    { label: 'Dev Score', va: sa.total || 0, vb: sb.total || 0, fmt: full },
    { label: 'Total Stars', va: stA.total_stars || 0, vb: stB.total_stars || 0, fmt: compact },
    { label: 'Followers', va: pa.followers || 0, vb: pb.followers || 0, fmt: compact },
    { label: 'Repositories', va: stA.own_repos || 0, vb: stB.own_repos || 0, fmt: full },
    { label: 'Languages', va: Object.keys(a.languages || {}).length, vb: Object.keys(b.languages || {}).length, fmt: full },
    { label: 'Longest Streak', va: strA.longest || 0, vb: strB.longest || 0, fmt: n => `${n}d` },
  ];

  let winsA = 0;
  let winsB = 0;
  metrics.forEach(m => {
    if (m.va > m.vb) winsA++;
    else if (m.vb > m.va) winsB++;
  });

  const winner = winsA > winsB ? pa : winsB > winsA ? pb : null;

  function renderSide(p, arch, tag) {
    const isTagA = tag === 'A';
    return `
      <div class="flex flex-col items-center rounded-2xl border border-line bg-surface p-6 text-center">
        <span class="self-start rounded font-mono text-[10px] font-bold px-2 py-0.5 ${
          isTagA ? 'bg-accent text-surface' : 'bg-lime text-onlime'
        }">
          TARGET ${tag}
        </span>
        <img src="${avatarUrl(p.login, 180)}" alt="${esc(p.name || p.login)}"
          class="h-20 w-20 rounded-full mt-3 bg-raised object-cover" />
        <h2 class="mt-4 text-xl font-semibold tracking-tight text-ink">${esc(p.name || p.login)}</h2>
        <p class="font-mono text-sm text-muted">@${esc(p.login)}</p>
        <span class="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[10px] font-bold text-ink">
          ${esc(arch?.label || 'Code Craftsman')}
        </span>
        <p class="mt-3 text-xs text-muted line-clamp-2 leading-relaxed">${esc(p.bio || '')}</p>
        <button type="button" data-compare-open="${p.login}"
          class="mt-auto pt-5 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
          Open full dossier &rarr;
        </button>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button type="button" id="compareBackBtn"
            class="mb-2 flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors font-medium">
            &larr; New search
          </button>
          <h1 class="font-mono text-sm font-semibold tracking-[0.16em] text-ink uppercase">Dual Target Scan</h1>
        </div>
        ${winner ? `
          <div class="flex items-center gap-2 rounded-full bg-lime/15 px-3 py-1.5 text-xs text-limeink font-medium">
            ${icon('trophy', 'w-4 h-4 text-limeink')} <span class="font-bold">@${esc(winner.login)}</span> wins ${Math.max(winsA, winsB)}–${Math.min(winsA, winsB)}
          </div>
        ` : '<span class="font-mono text-xs text-muted">Scan Draw</span>'}
      </div>

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
        ${renderSide(pa, a.archetype, 'A')}

        <!-- Middle VS section -->
        <section class="rounded-2xl border border-line bg-surface p-6 flex flex-col justify-center">
          <div class="flex items-center justify-center">
            <span class="grid h-14 w-14 place-items-center rounded-full border border-line bg-raised font-mono text-lg font-bold tracking-tight text-ink">
              VS
            </span>
          </div>

          <ul class="mt-6 space-y-4">
            ${metrics.map(m => {
              const total = m.va + m.vb || 1;
              const isWinA = m.va > m.vb;
              const isWinB = m.vb > m.va;
              const pctA = (m.va / total) * 100;
              const pctB = (m.vb / total) * 100;

              return `
                <li>
                  <div class="grid grid-cols-[1fr_auto_1fr] items-baseline gap-3">
                    <span class="font-mono text-sm tabular-nums ${isWinA ? 'font-bold text-ink' : 'text-muted'}">
                      ${m.fmt(m.va)}
                    </span>
                    <span class="text-center text-[11px] text-muted font-medium">${esc(m.label)}</span>
                    <span class="text-right font-mono text-sm tabular-nums ${isWinB ? 'font-bold text-ink' : 'text-muted'}">
                      ${m.fmt(m.vb)}
                    </span>
                  </div>
                  <div class="mt-1 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-line">
                    <div class="h-full rounded-l-full ${isWinA ? 'bg-accent' : 'bg-muted/40'}" style="width:${pctA}%"></div>
                    <div class="h-full rounded-r-full ${isWinB ? 'bg-lime' : 'bg-muted/40'}" style="width:${pctB}%"></div>
                  </div>
                </li>
              `;
            }).join('')}
          </ul>
        </section>

        ${renderSide(pb, b.archetype, 'B')}
      </div>
    </div>
  `;

  // Attach event listeners
  const backBtn = document.getElementById('compareBackBtn');
  if (backBtn) backBtn.addEventListener('click', onBack);

  container.querySelectorAll('[data-compare-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const login = btn.getAttribute('data-compare-open');
      if (login) onOpenDossier(login);
    });
  });
}
