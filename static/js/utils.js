/**
 * Git-Spectre Utility Functions
 * Sanitization, formatting, language colors, animations, and toast.
 */

// XSS Sanitizer for plain text strings
export function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

// XSS Sanitizer for URLs (rejects javascript:, data:, etc.)
export function safeUrl(u) {
  try {
    const p = new URL(u).protocol;
    return (p === 'http:' || p === 'https:') ? u : '#';
  } catch {
    return '#';
  }
}

// Compact number formatting (e.g. 1.2K, 3.4M)
export function compact(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  const num = Number(n);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return num.toLocaleString();
}

// Full integer formatting with commas (e.g. 12,345)
export function full(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  return Number(n).toLocaleString();
}

// Parse username from either a raw handle or full GitHub URL
export function parseTarget(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  str = str.replace(/^https?:\/\/(www\.)?github\.com\//i, '');
  str = str.replace(/^[#@]/, '');
  str = str.split(/[/?#]/)[0].trim();
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(str) ? str : '';
}

// GitHub avatar URL helper
export function avatarUrl(login, size = 120) {
  if (!login) return '';
  return `https://github.com/${encodeURIComponent(login)}.png?size=${size}`;
}

// Number count-up animation
export function animCount(el, target, dur = 1000) {
  if (!el) return;
  const t = Number(target) || 0;
  const start = performance.now();
  const step = now => {
    const p = Math.min((now - start) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 4); // easeOutQuart
    el.textContent = Math.floor(ease * t).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = t.toLocaleString();
  };
  requestAnimationFrame(step);
}

// Language color mapping with fallback HSL hashing
const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', HTML: '#e34c26',
  CSS: '#563d7c', Rust: '#dea584', Go: '#00ADD8', C: '#555555', 'C++': '#f34b7d',
  'C#': '#178600', Java: '#b07219', PHP: '#4F5D95', Ruby: '#701516', Swift: '#F05138',
  Kotlin: '#A97BFF', Dart: '#00B4AB', Shell: '#89e051', Vue: '#41b883', React: '#61dafb',
  Svelte: '#ff3e00', Lua: '#000080', Zig: '#ec915c', Elixir: '#6e4a7e', Scala: '#c22d40',
  R: '#198CE7', Julia: '#a270ba', Haskell: '#5e5086', Clojure: '#db5855', Dockerfile: '#384d54'
};

export function getLangColor(name) {
  if (!name || name === 'N/A') return '#71717a';
  if (LANG_COLORS[name]) return LANG_COLORS[name];
  // Deterministic HSL hash
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 68%, 62%)`;
}

// Format ISO date into readable string
export function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return String(iso);
  }
}

export { icon, refreshIcons } from './icons.js';
import { icon as getIconSvg } from './icons.js';

// Simple Toast Notification
let _toastTimer = null;
export function showToast(msg, iconNameOrText = 'check') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'fixed top-5 right-5 z-[100] hidden items-center gap-3 px-4 py-2.5 rounded-xl border border-line bg-surface/95 text-ink text-sm font-medium shadow-2xl backdrop-blur-xl transition-all';
    el.innerHTML = '<span id="toastIcon" class="text-accent shrink-0 flex items-center"></span><span id="toastMsg"></span>';
    document.body.appendChild(el);
  }
  document.getElementById('toastMsg').textContent = msg;
  const iconCont = document.getElementById('toastIcon');
  if (iconNameOrText.startsWith('<svg')) {
    iconCont.innerHTML = iconNameOrText;
  } else if (/^[a-z0-9\-]+$/.test(iconNameOrText)) {
    iconCont.innerHTML = getIconSvg(iconNameOrText, 'w-4 h-4 text-accent');
  } else {
    iconCont.textContent = iconNameOrText;
  }
  el.classList.remove('hidden');
  el.classList.add('flex');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.add('hidden');
    el.classList.remove('flex');
  }, 2600);
}
