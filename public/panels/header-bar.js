// Top strip: VOTV_MP / branch / short SHA / phase badge / commit type / "ago" timestamp.
// Listens to dashboard:update and to a 30s tick for the "ago" text.

import { onUpdate } from '/core/state-client.js';
import { icon } from '/core/icons.js';

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400)return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function phaseClass(family) {
  if (!family) return '';
  if (family === '5N') return 'phase-5N';
  if (family.startsWith('5S')) return 'phase-5S';
  if (family === 'Gap') return 'phase-Gap';
  if (family === 'Bug') return 'phase-Bug';
  return '';
}

export function mountHeader(container) {
  container.innerHTML = `
    <div class="header">
      <span class="header__logo">VOTV_MP</span>
      <span class="header__sep">/</span>
      <span class="header__branch" id="hdr-branch">…</span>
      <span class="header__sep">·</span>
      <span class="header__sha" id="hdr-sha">…</span>
      <span class="header__phase" id="hdr-phase" hidden></span>
      <span class="header__type"  id="hdr-type"  hidden></span>
      <span class="header__ago"   id="hdr-ago">connecting…</span>
    </div>
  `;
  const $branch = container.querySelector('#hdr-branch');
  const $sha    = container.querySelector('#hdr-sha');
  const $phase  = container.querySelector('#hdr-phase');
  const $type   = container.querySelector('#hdr-type');
  const $ago    = container.querySelector('#hdr-ago');

  let lastTs = null;

  function render(state) {
    if (!state || !state.head) return;
    const h = state.head;
    $branch.textContent = h.branch || 'main';
    $sha.textContent    = h.shortSha ? `#${h.shortSha}` : '—';

    if (h.phase) {
      $phase.hidden = false;
      $phase.textContent = h.phaseRaw || h.phase;
      $phase.className = 'header__phase ' + phaseClass(h.phaseFamily);
    } else {
      $phase.hidden = true;
    }

    if (h.commitType && h.commitType !== 'other') {
      $type.hidden = false;
      $type.textContent = `[${h.tag || h.commitType}]`;
      $type.style.background = `var(--type-${h.commitType})`;
      $type.style.color = ['audit', 'coop'].includes(h.commitType) ? '#1f1500' : 'white';
    } else {
      $type.hidden = true;
    }

    lastTs = h.lastCommitAt;
    $ago.textContent = timeAgo(lastTs);
  }

  onUpdate(render);
  setInterval(() => { $ago.textContent = timeAgo(lastTs); }, 30000);
}
