/**
 * PDF Export Helpers
 * Color manipulation, text fitting, vector icon drawing, and chart canvas generators for jsPDF.
 */

export function hexToRgb(color, fallback = [139, 108, 255]) {
  if (!color || typeof color !== 'string') return fallback;
  const c = color.trim();
  if (c.startsWith('#')) {
    let hex = c.slice(1);
    if (hex.length === 3) hex = hex.split('').map((x) => x + x).join('');
    const num = parseInt(hex.slice(0, 6), 16);
    if (!Number.isNaN(num)) {
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
  }
  const rgbMatch = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
  }
  return fallback;
}

export function blendRgb(rgb, alpha, bg = [18, 18, 26]) {
  return [
    Math.round(rgb[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(rgb[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(rgb[2] * alpha + bg[2] * (1 - alpha)),
  ];
}

export function cleanText(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/\u00A0/g, ' ')
    .replace(/…/g, '...')
    .replace(/[—–]/g, '-')
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fitText(doc, str, maxWidthMm) {
  const s = cleanText(str);
  if (!s) return '';
  if (doc.getTextWidth(s) <= maxWidthMm) return s;
  const ellipsis = '...';
  const ellW = doc.getTextWidth(ellipsis);
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (doc.getTextWidth(s.slice(0, mid)) + ellW <= maxWidthMm) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return s.slice(0, Math.max(1, lo)).trimEnd() + ellipsis;
}

export function drawPdfIcon(doc, type, cx, cy, r = 1.4, rgb = [255, 255, 255]) {
  doc.setDrawColor(...rgb);
  doc.setFillColor(...rgb);
  doc.setLineWidth(0.28);

  if (type === 'star') {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.44;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push([cx + rad * Math.cos(angle), cy + rad * Math.sin(angle)]);
    }
    const deltas = [];
    for (let i = 1; i < pts.length; i++) {
      deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
    }
    doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], 'F', true);
  } else if (type === 'fork') {
    const nr = r * 0.28;
    doc.circle(cx - r * 0.55, cy - r * 0.65, nr, 'S');
    doc.circle(cx + r * 0.55, cy - r * 0.65, nr, 'S');
    doc.circle(cx, cy + r * 0.7, nr, 'S');
    doc.line(cx - r * 0.55, cy - r * 0.35, cx - r * 0.55, cy - r * 0.05);
    doc.line(cx + r * 0.55, cy - r * 0.35, cx + r * 0.55, cy - r * 0.05);
    doc.line(cx - r * 0.55, cy - r * 0.05, cx, cy + r * 0.15);
    doc.line(cx + r * 0.55, cy - r * 0.05, cx, cy + r * 0.15);
    doc.line(cx, cy + r * 0.15, cx, cy + r * 0.42);
  } else if (type === 'issue') {
    doc.circle(cx, cy, r * 0.85, 'S');
    doc.circle(cx, cy, r * 0.28, 'F');
  } else if (type === 'check') {
    doc.circle(cx, cy, r * 0.95, 'F');
    doc.setDrawColor(12, 16, 14);
    doc.setLineWidth(0.35);
    doc.line(cx - r * 0.45, cy + r * 0.02, cx - r * 0.1, cy + r * 0.38);
    doc.line(cx - r * 0.1, cy + r * 0.38, cx + r * 0.48, cy - r * 0.35);
  } else if (type === 'cross') {
    doc.circle(cx, cy, r * 0.95, 'S');
    doc.line(cx - r * 0.35, cy, cx + r * 0.35, cy);
  } else if (type === 'badge') {
    const d = r * 0.9;
    doc.lines([[d, d], [-d, d], [-d, -d]], cx, cy - d, [1, 1], 'F', true);
  } else if (type === 'lock') {
    doc.roundedRect(cx - r * 0.65, cy - r * 0.1, r * 1.3, r * 1.0, 0.3, 0.3, 'S');
    doc.circle(cx, cy - r * 0.25, r * 0.4, 'S');
  }
}

export function createCircularAvatarDataUrl(img, nameFallback = 'D') {
  const size = 240;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');

  const r = 52;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(size, 0, size, size, r);
  ctx.arcTo(size, size, 0, size, r);
  ctx.arcTo(0, size, 0, 0, r);
  ctx.arcTo(0, 0, size, 0, r);
  ctx.closePath();
  ctx.save();
  ctx.clip();

  if (img) {
    ctx.drawImage(img, 0, 0, size, size);
  } else {
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#c4b5fd';
    ctx.font = 'bold 110px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(nameFallback).charAt(0).toUpperCase(), size / 2, size / 2);
  }
  ctx.restore();

  ctx.strokeStyle = '#8b6cff';
  ctx.lineWidth = 8;
  ctx.stroke();

  return c.toDataURL('image/png');
}

export function createRingChartDataUrl({
  segments = [],
  centerTop = '',
  centerTopColor = '#ffffff',
  centerSub = '',
  size = 220,
  thickness = 22,
}) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - thickness * 2) / 2;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#232332';
  ctx.lineWidth = thickness;
  ctx.stroke();

  let startAngle = -Math.PI / 2;
  segments.forEach((seg) => {
    const frac = Math.max(0, Math.min(1, Number(seg.fraction) || 0));
    if (frac <= 0) return;
    const sweep = frac * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + sweep);
    ctx.strokeStyle = seg.color || '#8b6cff';
    ctx.lineWidth = thickness;
    ctx.lineCap = segments.length === 1 ? 'round' : 'butt';
    ctx.stroke();
    startAngle += sweep;
  });

  if (centerTop) {
    ctx.fillStyle = centerTopColor;
    ctx.font = `800 ${Math.round(size * 0.2)}px 'JetBrains Mono', monospace, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(centerTop), cx, centerSub ? cy - size * 0.05 : cy);
  }
  if (centerSub) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = `600 ${Math.round(size * 0.085)}px 'Inter', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(centerSub), cx, cy + size * 0.12);
  }

  return c.toDataURL('image/png');
}

export function drawPageChrome(doc, pageNum, totalPages, login, PW, PH, M) {
  doc.setFillColor(9, 9, 13);
  doc.rect(0, 0, PW, PH, 'F');

  // Top Bar
  doc.setFillColor(18, 18, 26);
  doc.rect(0, 0, PW, 10, 'F');
  doc.setDrawColor(40, 40, 55);
  doc.setLineWidth(0.25);
  doc.line(0, 10, PW, 10);

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(198, 244, 50);
  doc.text('GIT-SPECTRE', M, 6.4);
  doc.setTextColor(130, 130, 148);
  doc.setFont('courier', 'normal');
  doc.text(`// DEVELOPER DEEP-PROFILER DOSSIER  |  @${login}`, M + 21, 6.4);
  doc.text(`PAGE ${pageNum} OF ${totalPages}`, PW - M, 6.4, { align: 'right' });

  // Footer
  doc.setDrawColor(32, 32, 44);
  doc.line(M, PH - 10, PW - M, PH - 10);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 126);
  doc.text(`Generated by Git-Spectre  |  https://git-spectre.vercel.app/?u=${login}`, M, PH - 5.5);
  doc.text(new Date().toISOString().slice(0, 10), PW - M, PH - 5.5, { align: 'right' });
}

export function drawCard(doc, x, y, w, h, fill = [16, 16, 23], stroke = [38, 38, 52], r = 3.5) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...stroke);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, r, r, 'FD');
}

export function drawSectionHeader(doc, title, y, M, PW) {
  const cleanTitle = cleanText(title).toUpperCase();
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 168);
  doc.text(cleanTitle, M, y);
  const tw = doc.getTextWidth(cleanTitle);
  doc.setDrawColor(38, 38, 52);
  doc.setLineWidth(0.25);
  doc.line(M + tw + 4, y - 1, PW - M, y - 1);
}
