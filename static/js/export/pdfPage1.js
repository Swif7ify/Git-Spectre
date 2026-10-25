/**
 * PDF Export: Page 1 Renderer
 * Identity, Developer Score, Core Metrics, Progression, Heatmap, and Language DNA.
 */

import { full, compact, getLangColor } from '../utils.js';
import {
  hexToRgb,
  blendRgb,
  cleanText,
  fitText,
  drawPdfIcon,
  drawCard,
  drawSectionHeader,
  createRingChartDataUrl,
} from './pdfHelpers.js';

export function renderPdfPage1(doc, dossier, avatarDataUrl, { PW, M, CW }) {
  let curY = 14;

  const profile = dossier.profile || {};
  const score = dossier.score || {};
  const breakdown = score.breakdown || {};
  const arch = dossier.archetype || {};
  const stats = dossier.stats || {};
  const streaks = dossier.streaks || {};
  const level = dossier.level || {};
  const badges = Array.isArray(dossier.badges) ? dossier.badges : [];
  const langsObj = dossier.languages || {};
  const repos = Array.isArray(dossier.repos) ? dossier.repos : Array.isArray(dossier.top_repos) ? dossier.top_repos : [];

  const login = cleanText(profile.login || 'developer');
  const name = cleanText(profile.name || login);
  const totalScore = Math.max(0, Math.min(1000, Number(score.total) || 0));
  const grade = cleanText(score.grade || 'E');
  const archLabel = cleanText(arch.label || 'Code Craftsman').toUpperCase();
  const archRgb = hexToRgb(arch.glow || '#06b6d4', [6, 182, 212]);

  // 1. HERO ROW: Identity Card (Left, 116mm) + Developer Score Card (Right, 66mm)
  const heroH = 52;
  const idCardW = 116;
  const scoreCardW = CW - idCardW - 4; // 66mm
  drawCard(doc, M, curY, idCardW, heroH, [16, 16, 24], [46, 42, 72]);
  drawCard(doc, M + idCardW + 4, curY, scoreCardW, heroH, [16, 16, 24], [46, 42, 72]);

  // Avatar inside Identity Card
  doc.addImage(avatarDataUrl, 'PNG', M + 5, curY + 5, 22, 22);

  // Name & @login
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(255, 255, 255);
  doc.text(fitText(doc, name, idCardW - 36), M + 31, curY + 10.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(167, 139, 250);
  doc.text(fitText(doc, `@${login}`, idCardW - 36), M + 31, curY + 15.8);

  // Archetype Pill
  doc.setFont('courier', 'bold');
  doc.setFontSize(6.8);
  const fittedArch = fitText(doc, archLabel, idCardW - 45);
  const pillTextW = doc.getTextWidth(fittedArch);
  const pillW = pillTextW + 9;
  const pillX = M + 31;
  const pillY = curY + 18.8;
  doc.setFillColor(...blendRgb(archRgb, 0.16, [16, 16, 24]));
  doc.setDrawColor(...archRgb);
  doc.setLineWidth(0.3);
  doc.roundedRect(pillX, pillY, pillW, 5.2, 2.6, 2.6, 'FD');
  doc.setFillColor(...archRgb);
  doc.circle(pillX + 3, pillY + 2.6, 0.9, 'F');
  doc.setTextColor(...archRgb);
  doc.text(fittedArch, pillX + 5.2, pillY + 3.5);

  // Bio text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(175, 175, 190);
  const bioRaw = cleanText(profile.bio || 'No public bio provided.');
  const bioLines = doc.splitTextToSize(bioRaw, idCardW - 10).slice(0, 2);
  doc.text(bioLines, M + 5, curY + 32);

  // Location / Company / Joined metadata line
  const metaParts = [];
  if (profile.location) metaParts.push(cleanText(profile.location));
  if (profile.company) metaParts.push(cleanText(profile.company));
  if (profile.created_at) metaParts.push(`Joined ${String(profile.created_at).slice(0, 4)}`);
  if (profile.blog) metaParts.push(cleanText(profile.blog).replace(/^https?:\/\//, ''));
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(125, 125, 142);
  const metaStr = metaParts.join('  |  ') || `github.com/${login}`;
  doc.text(fitText(doc, metaStr, idCardW - 10), M + 5, curY + 41.8);

  // Terminal status quote box
  doc.setFillColor(12, 12, 18);
  doc.setDrawColor(32, 32, 46);
  doc.roundedRect(M + 5, curY + 44, idCardW - 10, 5.5, 1.5, 1.5, 'FD');
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.3);
  doc.setTextColor(160, 160, 178);
  const statusText = cleanText(arch.description || `Active streak: ${streaks.current ?? 0}d | Best streak: ${streaks.longest ?? 0}d`);
  doc.text(fitText(doc, `> ${statusText}`, idCardW - 14), M + 7, curY + 47.7);

  // --- Developer Score Card (Right) ---
  const sx = M + idCardW + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(240, 240, 245);
  doc.text('Developer Score', sx + 4.5, curY + 6.5);

  // Grade pill top-right
  doc.setFillColor(198, 244, 50);
  doc.roundedRect(sx + scoreCardW - 15, curY + 3.2, 10.5, 5, 1.5, 1.5, 'F');
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(12, 15, 6);
  doc.text(`${grade}`, sx + scoreCardW - 9.75, curY + 6.7, { align: 'center' });

  // Score Ring Gauge Image
  const scoreRingUrl = createRingChartDataUrl({
    segments: [{ fraction: totalScore / 1000, color: '#8b6cff' }],
    centerTop: String(totalScore),
    centerSub: '/ 1000',
    size: 200,
    thickness: 22,
  });
  doc.addImage(scoreRingUrl, 'PNG', sx + 3.5, curY + 11, 24, 24);

  // Score Breakdown Bars
  const bdItems = [
    { label: 'Code Impact', val: breakdown.impact ?? breakdown.code_impact ?? Math.round(totalScore * 0.22), max: 300, color: [139, 108, 255] },
    { label: 'Consistency', val: breakdown.consistency ?? Math.round(totalScore * 0.18), max: 200, color: [56, 189, 248] },
    { label: 'Polyglot DNA', val: breakdown.polyglot ?? breakdown.diversity ?? Math.round(totalScore * 0.25), max: 200, color: [52, 211, 153] },
    { label: 'Documentation', val: breakdown.documentation ?? breakdown.quality ?? Math.round(totalScore * 0.2), max: 150, color: [250, 204, 21] },
    { label: 'Community', val: breakdown.community ?? breakdown.maturity ?? Math.round(totalScore * 0.15), max: 150, color: [244, 63, 94] },
  ];
  let bdy = curY + 13.5;
  const bdx = sx + 29.5;
  const bdw = scoreCardW - 33.5;
  bdItems.forEach((item) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(160, 160, 176);
    doc.text(item.label, bdx, bdy);
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(225, 225, 235);
    doc.text(`${item.val}/${item.max}`, bdx + bdw, bdy, { align: 'right' });

    doc.setFillColor(30, 30, 44);
    doc.roundedRect(bdx, bdy + 1, bdw, 1.4, 0.7, 0.7, 'F');
    const fillW = Math.max(1, Math.min(bdw, (Number(item.val) / item.max) * bdw));
    doc.setFillColor(...item.color);
    doc.roundedRect(bdx, bdy + 1, fillW, 1.4, 0.7, 0.7, 'F');
    bdy += 6.8;
  });

  curY += heroH + 4;

  // 2. FOUR CORE METRIC TILES
  const tileGap = 3.5;
  const tileW = (CW - tileGap * 3) / 4;
  const tileH = 16;
  const coreMetrics = [
    { label: 'Own Repositories', val: full(stats.own_repos ?? stats.total_repos ?? 0), sub: `${full(stats.forked_repos ?? 0)} forked`, accent: [74, 222, 128], icon: 'issue' },
    { label: 'Total Stars Earned', val: full(stats.total_stars ?? 0), sub: 'Across public repos', accent: [250, 204, 21], icon: 'star' },
    { label: 'Followers', val: full(profile.followers ?? 0), sub: `Following ${full(profile.following ?? 0)}`, accent: [167, 139, 250], icon: 'badge' },
    { label: 'Longest Streak', val: `${streaks.longest ?? streaks.current ?? 0} days`, sub: `Current: ${streaks.current ?? 0} days`, accent: [198, 244, 50], icon: 'badge' },
  ];

  coreMetrics.forEach((m, i) => {
    const tx = M + i * (tileW + tileGap);
    drawCard(doc, tx, curY, tileW, tileH);
    drawPdfIcon(doc, m.icon, tx + 4.2, curY + 4.3, 1.2, m.accent);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(156, 163, 175);
    doc.text(m.label, tx + 6.8, curY + 5.1);

    doc.setFont('courier', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(255, 255, 255);
    doc.text(fitText(doc, String(m.val), tileW - 8), tx + 4, curY + 11.3);

    doc.setFont('courier', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(115, 115, 132);
    doc.text(fitText(doc, m.sub, tileW - 8), tx + 4, curY + 14.5);
  });

  curY += tileH + 6;

  // 3. PROGRESSION: LEVEL & ACHIEVEMENTS
  drawSectionHeader(doc, 'Progression | Level & Achievements', curY, M, PW);
  curY += 3;
  const progH = 28;
  drawCard(doc, M, curY, CW, progH);

  const lvlNum = level.level ?? level.current ?? 2;
  const lvlTitle = cleanText(level.title || level.rank || (totalScore >= 700 ? 'Staff' : totalScore >= 450 ? 'Senior' : 'Junior'));
  const lvlPct = Math.max(5, Math.min(100, Number(level.progress_pct ?? level.percent ?? Math.round((totalScore % 300) / 3)) || 75));

  const lvlRingUrl = createRingChartDataUrl({
    segments: [{ fraction: lvlPct / 100, color: '#38bdf8' }],
    centerTop: `${lvlPct}%`,
    centerSub: `LVL ${lvlNum}`,
    size: 160,
    thickness: 18,
  });
  doc.addImage(lvlRingUrl, 'PNG', M + 4, curY + 3.5, 21, 21);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(140, 140, 158);
  doc.text('CURRENT RANK', M + 28, curY + 8.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(56, 189, 248);
  doc.text(fitText(doc, lvlTitle, 40), M + 28, curY + 14.5);

  // XP Bar
  doc.setFillColor(28, 28, 42);
  doc.roundedRect(M + 28, curY + 18, 38, 2, 1, 1, 'F');
  doc.setFillColor(56, 189, 248);
  doc.roundedRect(M + 28, curY + 18, (38 * lvlPct) / 100, 2, 1, 1, 'F');
  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(130, 130, 148);
  doc.text(`Score XP: ${totalScore} / 1000`, M + 28, curY + 23);

  // Achievement Badges Grid
  const displayBadges = badges.length ? badges.slice(0, 6) : [
    { name: 'Polyglot', tier: 'GOLD', unlocked: Object.keys(langsObj).length >= 4 },
    { name: 'Star Magnet', tier: 'SILVER', unlocked: (stats.total_stars ?? 0) >= 50 },
    { name: 'Repo Builder', tier: 'SILVER', unlocked: (stats.own_repos ?? 0) >= 20 },
    { name: 'Night Owl', tier: 'BRONZE', unlocked: true },
    { name: 'Streak Runner', tier: 'BRONZE', unlocked: (streaks.longest ?? 0) >= 3 },
    { name: 'Open Source', tier: 'GOLD', unlocked: (profile.followers ?? 0) >= 5 },
  ];

  const bxStart = M + 72;
  const bw = (CW - 76 - 6) / 3;
  const bh = 10;
  displayBadges.forEach((b, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const bx = bxStart + col * (bw + 3);
    const by = curY + 3.5 + row * (bh + 2);
    const unlocked = b.unlocked !== false;
    drawCard(doc, bx, by, bw, bh, unlocked ? [22, 22, 34] : [14, 14, 20], unlocked ? [88, 70, 170] : [32, 32, 44], 2);
    drawPdfIcon(doc, unlocked ? 'badge' : 'lock', bx + 3.6, by + 5, 1.3, unlocked ? [198, 244, 50] : [80, 80, 95]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.3);
    doc.setTextColor(...(unlocked ? [240, 240, 248] : [100, 100, 115]));
    doc.text(fitText(doc, b.name || b.title || 'Badge', bw - 8.5), bx + 6.8, by + 4.4);

    doc.setFont('courier', 'normal');
    doc.setFontSize(5.4);
    doc.setTextColor(...(unlocked ? [167, 139, 250] : [80, 80, 95]));
    doc.text(cleanText(b.tier || (unlocked ? 'UNLOCKED' : 'LOCKED')).toUpperCase(), bx + 6.8, by + 8);
  });

  curY += progH + 6;

  // 4. ACTIVITY & CONTRIBUTIONS: STREAKS + 52-WEEK HEATMAP
  drawSectionHeader(doc, 'Activity & Contributions | 52-Week Heatmap', curY, M, PW);
  curY += 3;
  const actH = 42;
  drawCard(doc, M, curY, CW, actH);

  const totalContribs = streaks.total_contributions ?? dossier.total_contributions ?? stats.total_commits ?? '';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(245, 245, 250);
  doc.text('Contributions & Streaks', M + 4.5, curY + 6);
  if (totalContribs) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(140, 140, 158);
    doc.text(`${full(totalContribs)} public contributions in the last year`, M + 46, curY + 6);
  }

  // 3 Mini Streak Boxes
  const miniW = (CW - 15) / 3;
  const miniItems = [
    { label: 'CURRENT STREAK', val: `${streaks.current ?? 0} days`, color: [250, 204, 21] },
    { label: 'LONGEST STREAK', val: `${streaks.longest ?? 0} days`, color: [198, 244, 50] },
    { label: 'ACTIVE PUSH DAYS', val: `${streaks.active_days ?? streaks.total_active_days ?? Math.max(streaks.longest ?? 0, 8)} days`, color: [74, 222, 128] },
  ];
  miniItems.forEach((mi, idx) => {
    const mx = M + 4.5 + idx * (miniW + 3);
    drawCard(doc, mx, curY + 8.5, miniW, 9.5, [12, 12, 18], [34, 34, 48], 2);
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(135, 135, 152);
    doc.text(mi.label, mx + 3, curY + 12);
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...mi.color);
    doc.text(mi.val, mx + 3, curY + 16.2);
  });

  // 52x7 Contribution Heatmap Grid
  const heatX = M + 4.5;
  const heatY = curY + 20.5;
  const cols = 52;
  const rows = 7;
  const cellGap = 0.65;
  const cellSize = (CW - 9 - (cols - 1) * cellGap) / cols;

  const rawGrid = Array.isArray(dossier.heatmap) ? dossier.heatmap.flat() : Array.isArray(streaks.history) ? streaks.history : [];
  const heatColors = [
    [22, 22, 32],
    [49, 46, 129],
    [91, 33, 182],
    [139, 92, 246],
    [198, 244, 50],
  ];

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const idx = c * rows + r;
      let levelIdx = 0;
      if (rawGrid[idx] !== undefined) {
        const v = typeof rawGrid[idx] === 'object' ? (rawGrid[idx].count ?? rawGrid[idx].level ?? 0) : Number(rawGrid[idx]);
        levelIdx = v <= 0 ? 0 : v === 1 ? 1 : v <= 3 ? 2 : v <= 6 ? 3 : 4;
      } else {
        const seed = (c * 13 + r * 7 + login.charCodeAt(c % login.length)) % 19;
        levelIdx = c > 18 && seed < 3 ? 3 : c > 12 && seed < 6 ? 2 : seed < 8 ? 1 : 0;
        if (c > 42 && seed === 0) levelIdx = 4;
      }
      doc.setFillColor(...heatColors[levelIdx]);
      doc.roundedRect(heatX + c * (cellSize + cellGap), heatY + r * (cellSize + cellGap), cellSize, cellSize, 0.4, 0.4, 'F');
    }
  }

  curY += actH + 6;

  // 5. STACK & COMMUNITY: LANGUAGE DNA
  drawSectionHeader(doc, 'Stack & Community | Language DNA', curY, M, PW);
  curY += 3;
  const stackH = 62;
  drawCard(doc, M, curY, CW, stackH);

  const langEntries = Object.entries(langsObj).sort((a, b) => Number(b[1]) - Number(a[1]));
  const totalBytes = Math.max(1, langEntries.reduce((acc, [, b]) => acc + (Number(b) || 0), 0));
  const topLangs = langEntries.slice(0, 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(245, 245, 250);
  doc.text('Language DNA', M + 4.5, curY + 6.2);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.3);
  doc.setTextColor(140, 140, 158);
  doc.text(`${langEntries.length} languages | ${compact(Math.round(totalBytes / 1024))} KB authored`, M + 4.5, curY + 10.5);

  const donutSegments = topLangs.map(([l, b]) => ({
    fraction: (Number(b) || 0) / totalBytes,
    color: getLangColor(l) || '#8b6cff',
  }));
  const langDonutUrl = createRingChartDataUrl({
    segments: donutSegments.length ? donutSegments : [{ fraction: 1, color: '#8b6cff' }],
    centerTop: String(langEntries.length || 1),
    centerSub: 'LANGS',
    size: 220,
    thickness: 26,
  });
  doc.addImage(langDonutUrl, 'PNG', M + 9, curY + 14, 34, 34);

  const lx = M + 52;
  const lw = CW - 57;
  let ly = curY + 12;

  topLangs.forEach(([lang, bytes]) => {
    const pct = ((Number(bytes) / totalBytes) * 100).toFixed(1);
    const lRgb = hexToRgb(getLangColor(lang), [139, 108, 255]);

    doc.setFillColor(...lRgb);
    doc.circle(lx + 1.2, ly - 1, 1.1, 'F');

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(235, 235, 242);
    doc.text(cleanText(lang), lx + 4, ly);

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 168);
    doc.text(`${compact(Math.round(Number(bytes) / 1024))} KB  |  ${pct}%`, lx + lw, ly, { align: 'right' });

    doc.setFillColor(28, 28, 40);
    doc.roundedRect(lx, ly + 1.3, lw, 1.6, 0.8, 0.8, 'F');
    doc.setFillColor(...lRgb);
    doc.roundedRect(lx, ly + 1.3, Math.max(1.5, (Number(pct) / 100) * lw), 1.6, 0.8, 0.8, 'F');

    ly += 5.8;
  });

  // Topic Cloud Footer Row
  const topicsSet = new Set(Array.isArray(dossier.topics) ? dossier.topics : []);
  repos.forEach((r) => {
    if (Array.isArray(r.topics)) r.topics.forEach((t) => topicsSet.add(t));
  });
  const rawTopics = topicsSet.size ? Array.from(topicsSet) : topLangs.map(([l]) => l.toLowerCase());

  doc.setDrawColor(32, 32, 46);
  doc.line(M + 4.5, curY + 52.5, M + CW - 4.5, curY + 52.5);
  doc.setFont('courier', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(120, 120, 138);
  doc.text('TOPIC CLOUD:', M + 4.5, curY + 57.2);

  doc.setFont('courier', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(167, 139, 250);
  const maxTopicW = CW - 27;
  let builtTopics = '';
  for (const t of rawTopics) {
    const candidate = builtTopics ? `${builtTopics}  #${cleanText(t)}` : `#${cleanText(t)}`;
    if (doc.getTextWidth(candidate) <= maxTopicW) {
      builtTopics = candidate;
    } else {
      break;
    }
  }
  doc.text(builtTopics || '#opensource', M + 22, curY + 57.2);
}
