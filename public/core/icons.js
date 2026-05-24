// SVG icon registry. One job: name -> inline SVG markup.
// Kept minimal; only icons actually used in panels live here.

const BRANCH = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
  <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/>
</svg>`;

const DOT = `<svg viewBox="0 0 8 8" width="8" height="8" fill="currentColor" aria-hidden="true"><circle cx="4" cy="4" r="3"/></svg>`;

const PULSE = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
  <path d="M0 7.5v1h2.708L4.5 2.5l3 12 3-9 1.5 3H16v-1h-3.292l-1.792-3-3 9-3-12-2 5z"/>
</svg>`;

const ICONS = { BRANCH, DOT, PULSE };

export function icon(name) { return ICONS[name] || ''; }
