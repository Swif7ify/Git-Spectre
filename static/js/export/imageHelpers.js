/**
 * Export Image Loading Helpers
 * Cross-origin image loaders for profile avatars, ghost icons, and logo assets.
 */

import { avatarUrl } from '../utils.js';

export function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function fetchAvatarImage(login, profileAvatarUrl) {
  const candidates = [
    profileAvatarUrl,
    `https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=200`,
    avatarUrl ? avatarUrl(login, 200) : null,
  ].filter(Boolean);

  for (const url of candidates) {
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const img = await loadImage(dataUrl);
      if (img) return img;
    } catch (_) {}
  }
  return null;
}

let _cachedGhostDataUri = null;
export async function fetchGhostImage() {
  if (!_cachedGhostDataUri) {
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/></svg>`;
    try {
      const res = await fetch('/static/icon.svg');
      if (res.ok) {
        let svgText = await res.text();
        if (!svgText.includes('xmlns=')) {
          svgText = svgText.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        _cachedGhostDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
      }
    } catch (_) {}
    if (!_cachedGhostDataUri) {
      _cachedGhostDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fallbackSvg)}`;
    }
  }
  return loadImage(_cachedGhostDataUri);
}

let _cachedTextLogoUri = null;
export async function fetchTextLogoImage() {
  if (!_cachedTextLogoUri) {
    try {
      const res = await fetch('/static/text-icon.svg');
      if (res.ok) {
        let svgText = await res.text();
        if (!svgText.includes('xmlns=')) {
          svgText = svgText.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        _cachedTextLogoUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
      }
    } catch (_) {}
  }
  return _cachedTextLogoUri ? loadImage(_cachedTextLogoUri) : null;
}
