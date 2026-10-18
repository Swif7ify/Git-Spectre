/**
 * Vector PDF Dossier Export Coordinator
 * Orchestrates multi-page developer intelligence dossier generation in jsPDF.
 */

import { showToast } from '../utils.js';
import { cleanText, createCircularAvatarDataUrl, drawPageChrome } from './pdfHelpers.js';
import { fetchAvatarImage } from './imageHelpers.js';
import { renderPdfPage1 } from './pdfPage1.js';
import { renderPdfPage2 } from './pdfPage2.js';

export async function exportPdf(dossier) {
  if (!dossier || !dossier.profile) {
    showToast('No profile scanned yet', 'alert-triangle');
    return;
  }

  showToast('Generating full PDF dossier...', 'file-text');
  const btn = document.getElementById('dockBtnPdf');
  if (btn) btn.classList.add('opacity-50', 'pointer-events-none');

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    const PW = 210;
    const PH = 297;
    const M = 12;
    const CW = PW - M * 2; // 186mm content width
    const bounds = { PW, PH, M, CW };

    const profile = dossier.profile || {};
    const login = cleanText(profile.login || 'developer');
    const name = cleanText(profile.name || login);

    // Pre-fetch avatar
    const avatarImg = await fetchAvatarImage(login, profile.avatar_url);
    const avatarDataUrl = createCircularAvatarDataUrl(avatarImg, name);

    // --- Page 1: Identity, Score, Core Metrics, Progression, Heatmap & Stack DNA ---
    drawPageChrome(doc, 1, 2, login, PW, PH, M);
    renderPdfPage1(doc, dossier, avatarDataUrl, bounds);

    // --- Page 2: Code Quality, Community/External Work, Fork/Social/Gist & Top Repos ---
    doc.addPage();
    drawPageChrome(doc, 2, 2, login, PW, PH, M);
    renderPdfPage2(doc, dossier, bounds);

    doc.save(`git-spectre-${login}.pdf`);
    showToast('PDF dossier exported!', 'check');
  } catch (err) {
    showToast(`PDF Export failed: ${err.message}`, 'alert-triangle');
  } finally {
    if (btn) btn.classList.remove('opacity-50', 'pointer-events-none');
  }
}
