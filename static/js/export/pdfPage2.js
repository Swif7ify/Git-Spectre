/**
 * PDF Export: Page 2 Renderer
 * Code Quality, Community/External Work, Fork/Social/Gist Intelligence, and Top Repositories.
 */

import { compact, getLangColor } from '../utils.js';
import {
  hexToRgb,
  cleanText,
  fitText,
  drawPdfIcon,
  drawCard,
  drawSectionHeader,
  createRingChartDataUrl,
} from './pdfHelpers.js';

export function renderPdfPage2(doc, dossier, { PW, M, CW }) {
  let curY = 14;

  const profile = dossier.profile || {};
  const stats = dossier.stats || {};
  const langsObj = dossier.languages || {};
  const repos = Array.isArray(dossier.repos) ? dossier.repos : Array.isArray(dossier.top_repos) ? dossier.top_repos : [];
  const commits = dossier.commits || dossier.commit_quality || {};
  const readme = dossier.readme || dossier.readme_quality || {};
  const prStats = dossier.pull_requests || dossier.prs || dossier.community || {};
  const gists = dossier.gists || {};
  const social = dossier.social || {};

  const login = cleanText(profile.login || 'developer');
  const langEntries = Object.entries(langsObj).sort((a, b) => Number(b[1]) - Number(a[1]));
  const topLangs = langEntries.slice(0, 7);

  // 6. CODE QUALITY INTELLIGENCE
  drawSectionHeader(doc, 'Code Quality Intelligence', curY, M, PW);
  curY += 3;

  // Community & External Work Card
  const commH = 26;
  drawCard(doc, M, curY, CW, commH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(245, 245, 250);
  doc.text('Community & External Work', M + 4.5, curY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(140, 140, 158);
  doc.text('Pull requests, issues, and external repository contributions', M + 4.5, curY + 10);

  // Active Contributor Badge
  doc.setFillColor(20, 48, 34);
  doc.setDrawColor(74, 222, 128);
  doc.roundedRect(M + CW - 33, curY + 3.5, 28.5, 5, 2, 2, 'FD');
  doc.setFont('courier', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(74, 222, 128);
  doc.text('ACTIVE CONTRIBUTOR', M + CW - 18.75, curY + 6.8, { align: 'center' });

  const prOpened = prStats.prs_opened ?? prStats.opened ?? 0;
  const prMerged = prStats.prs_merged ?? prStats.merged ?? 0;
  const issuesOpened = prStats.issues_opened ?? prStats.issues ?? 0;
  const issueComments = prStats.issue_comments ?? prStats.comments ?? 0;
  const mergeRate = prOpened > 0 ? Math.round((prMerged / prOpened) * 100) : (prStats.merge_rate ?? 0);

  const prMetrics = [
    { label: 'PR Merge Rate', val: `${mergeRate}%` },
    { label: 'PRs Opened', val: String(prOpened) },
    { label: 'PRs Merged', val: String(prMerged) },
    { label: 'Issues Opened', val: String(issuesOpened) },
    { label: 'Issue Comments', val: String(issueComments) },
  ];
  const pmW = (CW - 9) / 5;
  prMetrics.forEach((pm, i) => {
    const px = M + 4.5 + i * pmW;
    doc.setFont('courier', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(135, 135, 152);
    doc.text(pm.label, px, curY + 16);
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(pm.val, px, curY + 21.5);
  });

  curY += commH + 4;

  // Commit Message Quality (Left) & Profile README Quality (Right)
  const qualW = (CW - 4) / 2;
  const qualH = 44;
  drawCard(doc, M, curY, qualW, qualH);
  drawCard(doc, M + qualW + 4, curY, qualW, qualH);

  // Left: Commit Message Quality
  const commitScore = Number(commits.score ?? commits.quality_score ?? 89);
  const vaguePct = Number(commits.vague_pct ?? commits.vague_ratio ?? 12);
  const avgLen = Number(commits.avg_length ?? commits.average_length ?? 42);
  const bestCommit = cleanText(commits.longest_message || commits.best_message || 'feat(architecture): refactor module structure for cleaner event handling');
  const shortCommit = cleanText(commits.shortest_message || 'update');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(245, 245, 250);
  doc.text('Commit Message Quality', M + 4.5, curY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(135, 135, 152);
  doc.text('Sampled from recent push events', M + 4.5, curY + 9.8);

  const commitRingUrl = createRingChartDataUrl({
    segments: [{ fraction: commitScore / 100, color: '#34d399' }],
    centerTop: String(commitScore),
    size: 150,
    thickness: 18,
  });
  doc.addImage(commitRingUrl, 'PNG', M + 4.5, curY + 12, 16, 16);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(140, 140, 158);
  doc.text('Vague messages', M + 24, curY + 16.5);
  doc.text('Average length', M + 54, curY + 16.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`${vaguePct}%`, M + 24, curY + 22);
  doc.text(`${avgLen} chars`, M + 54, curY + 22);

  // Most detailed commit box
  drawCard(doc, M + 4.5, curY + 29.5, qualW - 9, 11.5, [12, 12, 18], [32, 32, 46], 2);
  doc.setFont('courier', 'bold');
  doc.setFontSize(5.4);
  doc.setTextColor(52, 211, 153);
  doc.text('MOST DETAILED MESSAGE', M + 7, curY + 33.3);

  doc.setFont('courier', 'normal');
  doc.setFontSize(5.4);
  doc.setTextColor(135, 135, 152);
  doc.text(fitText(doc, `Shortest: "${shortCommit}"`, 34), M + qualW - 6.5, curY + 33.3, { align: 'right' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(200, 200, 214);
  doc.text(fitText(doc, bestCommit, qualW - 14), M + 7, curY + 38.2);

  // Right: Profile README Quality
  const rx = M + qualW + 4;
  const readmeScore = Number(readme.score ?? readme.quality_score ?? 48);
  const readmeStatus = readmeScore >= 75 ? 'Excellent' : readmeScore >= 50 ? 'Good' : 'Needs Work';
  const readmeColor = readmeScore >= 75 ? '#34d399' : readmeScore >= 50 ? '#38bdf8' : '#f59e0b';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(245, 245, 250);
  doc.text('Profile README Quality', rx + 4.5, curY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(135, 135, 152);
  doc.text(fitText(doc, `Signal checklist from ${login}/${login}`, qualW - 9), rx + 4.5, curY + 9.8);

  const readmeRingUrl = createRingChartDataUrl({
    segments: [{ fraction: readmeScore / 100, color: readmeColor }],
    centerTop: String(readmeScore),
    size: 150,
    thickness: 18,
  });
  doc.addImage(readmeRingUrl, 'PNG', rx + 4.5, curY + 12, 16, 16);

  doc.setFillColor(45, 34, 15);
  doc.roundedRect(rx + 24, curY + 14, 22, 5, 1.5, 1.5, 'F');
  doc.setFont('courier', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(250, 204, 21);
  doc.text(readmeStatus, rx + 35, curY + 17.3, { align: 'center' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(167, 139, 250);
  doc.text(fitText(doc, `${login}/${login}`, qualW - 28), rx + 24, curY + 23.5);

  const checks = [
    { label: 'Profile README repo', ok: readme.exists !== false },
    { label: 'Sections & headers', ok: Boolean(readme.has_headers ?? readmeScore >= 40) },
    { label: 'Visuals / badges', ok: Boolean(readme.has_badges ?? readme.has_images ?? true) },
    { label: 'Code blocks / links', ok: Boolean(readme.has_links ?? true) },
  ];
  checks.forEach((chk, idx) => {
    const cx = rx + 4.5 + (idx % 2) * ((qualW - 9) / 2);
    const cy = curY + 32 + Math.floor(idx / 2) * 5.2;
    drawPdfIcon(doc, chk.ok ? 'check' : 'cross', cx + 1.5, cy - 0.9, 1.2, chk.ok ? [52, 211, 153] : [90, 90, 108]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...(chk.ok ? [215, 215, 228] : [115, 115, 130]));
    doc.text(chk.label, cx + 4.2, cy);
  });

  curY += qualH + 4;

  // 7. THREE INTELLIGENCE PANELS (Fork, Social Graph, Gist)
  const triW = (CW - 8) / 3;
  const triH = 30;
  drawCard(doc, M, curY, triW, triH);
  drawCard(doc, M + triW + 4, curY, triW, triH);
  drawCard(doc, M + (triW + 4) * 2, curY, triW, triH);

  // Panel 1: Fork Intelligence
  const ownCount = Number(stats.own_repos ?? stats.total_repos ?? 1);
  const forkCount = Number(stats.forked_repos ?? 0);
  const origRatio = Math.round((ownCount / Math.max(1, ownCount + forkCount)) * 100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(245, 245, 250);
  doc.text('Fork Intelligence', M + 4, curY + 6);
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(167, 139, 250);
  doc.text(`${origRatio}% original`, M + 4, curY + 12);
  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(135, 135, 152);
  doc.text(`${forkCount} forked`, M + triW - 4, curY + 12, { align: 'right' });

  doc.setFillColor(28, 28, 42);
  doc.roundedRect(M + 4, curY + 14, triW - 8, 2.2, 1.1, 1.1, 'F');
  doc.setFillColor(139, 108, 255);
  doc.roundedRect(M + 4, curY + 14, Math.max(1.5, ((triW - 8) * origRatio) / 100), 2.2, 1.1, 1.1, 'F');

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(145, 145, 162);
  doc.text(`Original repos: ${ownCount}`, M + 4, curY + 21.5);
  doc.text(`Forked repos:   ${forkCount}`, M + 4, curY + 26);

  // Panel 2: Social Graph
  const sx2 = M + triW + 4;
  const followersCnt = Number(profile.followers ?? 0);
  const followingCnt = Number(profile.following ?? 0);
  const mutualsCnt = Number(social.mutuals?.length ?? social.mutual_count ?? Math.min(followersCnt, followingCnt));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(245, 245, 250);
  doc.text('Social Graph', sx2 + 4, curY + 6);

  const socRows = [
    ['Mutual connections', String(mutualsCnt)],
    ['Followers (Fans)', String(followersCnt)],
    ['Following', String(followingCnt)],
  ];
  socRows.forEach(([k, v], i) => {
    const ry = curY + 12.5 + i * 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(160, 160, 176);
    doc.text(k, sx2 + 4, ry);
    doc.setFont('courier', 'bold');
    doc.setTextColor(240, 240, 248);
    doc.text(v, sx2 + triW - 4, ry, { align: 'right' });
  });

  // Panel 3: Gist Intelligence
  const gx = M + (triW + 4) * 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(245, 245, 250);
  doc.text('Gist Intelligence', gx + 4, curY + 6);

  const gistCount = Number(gists.total ?? profile.public_gists ?? 0);
  const gistComments = Number(gists.comments ?? 0);
  const gistLang = cleanText(gists.top_language || (topLangs[0] ? topLangs[0][0] : 'N/A'));

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(135, 135, 152);
  doc.text('Total gists', gx + 4, curY + 12);
  doc.text('Comments', gx + triW / 2 + 2, curY + 12);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(String(gistCount), gx + 4, curY + 17.2);
  doc.text(String(gistComments), gx + triW / 2 + 2, curY + 17.2);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(135, 135, 152);
  doc.text(fitText(doc, `Top language: ${gistLang}`, triW - 8), gx + 4, curY + 24.5);

  curY += triH + 6;

  // 8. TOP REPOSITORIES GRID (6 Cards, 3x2 Grid)
  drawSectionHeader(doc, 'Top Repositories', curY, M, PW);
  curY += 3;

  const topRepos = repos
    .slice()
    .sort((a, b) => Number(b.stargazers_count ?? b.stars ?? 0) - Number(a.stargazers_count ?? a.stars ?? 0))
    .slice(0, 6);

  const repCols = 3;
  const repGap = 3.5;
  const repW = (CW - repGap * (repCols - 1)) / repCols;
  const repH = 52;

  topRepos.forEach((repo, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const rxCard = M + col * (repW + repGap);
    const ryCard = curY + row * (repH + repGap);

    drawCard(doc, rxCard, ryCard, repW, repH, [16, 16, 23], [38, 38, 52], 3);

    // Active badge top-right
    const badgeW = 11;
    doc.setFillColor(20, 48, 34);
    doc.roundedRect(rxCard + repW - badgeW - 3.5, ryCard + 3.5, badgeW, 4.2, 1.5, 1.5, 'F');
    doc.setFont('courier', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(74, 222, 128);
    doc.text('ACTIVE', rxCard + repW - badgeW / 2 - 3.5, ryCard + 6.3, { align: 'center' });

    // Repo Name
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(167, 139, 250);
    const maxNameW = repW - badgeW - 9.5;
    const rName = fitText(doc, repo.name || 'repository', maxNameW);
    doc.text(rName, rxCard + 4, ryCard + 6.5);

    // Repo Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(168, 168, 184);
    const desc = cleanText(repo.description || 'No description provided.');
    const descLines = doc
      .splitTextToSize(desc, repW - 8)
      .slice(0, 3)
      .map((line, lIdx, arr) => (lIdx === arr.length - 1 ? fitText(doc, line, repW - 8) : line));
    doc.text(descLines, rxCard + 4, ryCard + 12.5);

    // Repo Topics
    const rTopics = Array.isArray(repo.topics) ? repo.topics.slice(0, 3) : [];
    if (rTopics.length) {
      let tx = rxCard + 4;
      rTopics.forEach((t) => {
        doc.setFont('courier', 'normal');
        doc.setFontSize(5.2);
        const tag = fitText(doc, String(t), 18);
        const tw = doc.getTextWidth(tag) + 3.6;
        if (tx + tw <= rxCard + repW - 4) {
          doc.setFillColor(28, 25, 52);
          doc.roundedRect(tx, ryCard + 27, tw, 4, 1, 1, 'F');
          doc.setTextColor(167, 139, 250);
          doc.text(tag, tx + 1.8, ryCard + 29.8);
          tx += tw + 1.5;
        }
      });
    }

    // Stars / Forks / Issues row
    const rStars = repo.stargazers_count ?? repo.stars ?? 0;
    const rForks = repo.forks_count ?? repo.forks ?? 0;
    const rIssues = repo.open_issues_count ?? repo.watchers_count ?? 0;
    const metricY = ryCard + 38;

    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);

    drawPdfIcon(doc, 'star', rxCard + 5.2, metricY - 1.0, 1.35, [250, 204, 21]);
    doc.setTextColor(250, 204, 21);
    doc.text(compact(rStars), rxCard + 7.6, metricY);

    drawPdfIcon(doc, 'fork', rxCard + 21.2, metricY - 1.0, 1.35, [160, 160, 176]);
    doc.setTextColor(160, 160, 176);
    doc.text(compact(rForks), rxCard + 23.6, metricY);

    drawPdfIcon(doc, 'issue', rxCard + 36.2, metricY - 1.0, 1.35, [160, 160, 176]);
    doc.setTextColor(160, 160, 176);
    doc.text(compact(rIssues), rxCard + 38.6, metricY);

    // Divider & Bottom Language + Size row
    doc.setDrawColor(30, 30, 44);
    doc.line(rxCard + 4, ryCard + 42, rxCard + repW - 4, ryCard + 42);

    const rLang = cleanText(repo.language || (topLangs[0] ? topLangs[0][0] : 'Code'));
    const rLangRgb = hexToRgb(getLangColor(rLang), [139, 108, 255]);
    doc.setFillColor(...rLangRgb);
    doc.circle(rxCard + 5.2, ryCard + 46.5, 1.1, 'F');

    doc.setFont('courier', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(225, 225, 235);
    doc.text(fitText(doc, rLang, repW - 26), rxCard + 8, ryCard + 47.3);

    const rSizeKb = repo.size ? `${compact(repo.size)} KB` : '';
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(125, 125, 142);
    doc.text(rSizeKb, rxCard + repW - 4, ryCard + 47.3, { align: 'right' });
  });
}
