// Helpers shared by multiple panels. One job per export.

export function timeAgo(ts, { short = false } = {}) {
  if (!ts) return '—';
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  const suffix = short ? '' : ' ago';
  if (s < 60)    return `${s}s${suffix}`;
  if (s < 3600)  return `${Math.floor(s/60)}m${suffix}`;
  if (s < 86400) return `${Math.floor(s/3600)}h${suffix}`;
  return `${Math.floor(s/86400)}d${suffix}`;
}

export function phaseClass(family) {
  if (!family) return '';
  if (family === '5N') return 'phase-5N';
  if (family.startsWith('5S')) return 'phase-5S';
  if (family === 'Gap') return 'phase-Gap';
  if (family === 'Bug') return 'phase-Bug';
  return '';
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}
