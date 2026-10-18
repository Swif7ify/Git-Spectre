/**
 * Badge Export Helper
 * Copies Markdown badge snippet to clipboard.
 */

import { showToast } from '../utils.js';

export function copyBadgeSnippet(login) {
  if (!login) return;
  const snippet = `[![Git-Spectre](https://git-spectre.vercel.app/api/badge/${login})](https://git-spectre.vercel.app/?u=${login})`;
  navigator.clipboard
    .writeText(snippet)
    .then(() => showToast('Badge markdown copied to clipboard!', 'copy'))
    .catch(() => showToast('Could not copy badge', 'alert-triangle'));
}
