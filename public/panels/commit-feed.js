// Scrolling list of recent commits with type stripe, SHA, phase badge, severity highlight.
// On new commit (SHA at index 0 changes), the new card animates in.

import { onUpdate } from '/core/state-client.js';

function phaseClass(family) {
  if (!family) return '';
  if (family === '5N') return 'phase-5N';
  if (family.startsWith('5S')) return 'phase-5S';
  if (family === 'Gap') return 'phase-Gap';
  if (family === 'Bug') return 'phase-Bug';
  return '';
}

function timeAgo(ts) {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60)    return `${s}s`;
  if (s < 3600)  return `${Math.floor(s/60)}m`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  return `${Math.floor(s/86400)}d`;
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
}

function renderCommit(c, isHead) {
  const cls = ['commit', `commit--${c.commitType || 'other'}`];
  if (isHead) cls.push('commit--new');
  const phase = c.phaseRaw ? `<span class="commit__phase ${phaseClass(c.phaseFamily)}">${escape(c.phaseRaw)}</span>` : '';
  let badge = '';
  if (c.commitType === 'audit') {
    if (c.severity === 'CRITICAL') badge = `<span class="commit__badge commit__badge--critical">${c.issueCount ?? '!'} CRIT</span>`;
    else if (c.severity === 'IMPORTANT') badge = `<span class="commit__badge commit__badge--important">${c.issueCount ?? '!'} IMP</span>`;
    else if (c.issueCount != null) badge = `<span class="commit__badge">${c.issueCount} issues</span>`;
  }
  const delta = (c.linesAdded != null && c.linesRemoved != null)
    ? `<span class="delta-add">+${c.linesAdded}</span><span class="delta-rem">−${c.linesRemoved}</span>`
    : '';

  return `
    <article class="${cls.join(' ')}">
      <div class="commit__stripe"></div>
      <div class="commit__body">
        <div class="commit__row1">
          <span class="commit__type">[${escape(c.tag || c.commitType)}]</span>
          <span class="commit__sha">#${escape(c.shortSha)}</span>
          ${phase}
          ${badge}
        </div>
        <div class="commit__subject">${escape(c.subject || '')}</div>
        <div class="commit__meta">
          <span>${escape(c.author || '')}</span>
          <span>· ${timeAgo(c.timestamp)} ago</span>
          ${delta}
        </div>
      </div>
    </article>
  `;
}

export function mountCommitFeed(container) {
  container.innerHTML = `
    <div class="panel-title">
      <span>Commits</span>
      <span class="panel-title__meta" id="feed-count">—</span>
    </div>
    <div class="panel-body" id="feed-body">
      <div class="loading">waiting for first commit…</div>
    </div>
  `;
  const $body  = container.querySelector('#feed-body');
  const $count = container.querySelector('#feed-count');

  let lastHeadSha = null;

  onUpdate((state) => {
    if (!state || !Array.isArray(state.commits) || state.commits.length === 0) return;
    const commits = state.commits;
    const headSha = commits[0].sha;
    const isNew = headSha !== lastHeadSha;
    lastHeadSha = headSha;
    $count.textContent = `${commits.length} loaded`;
    $body.innerHTML = commits.map((c, i) => renderCommit(c, isNew && i === 0)).join('');
  });
}
