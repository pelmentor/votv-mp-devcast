// Scrolling list of recent commits with type stripe, SHA, phase badge, severity highlight.
// On new commit (SHA at index 0 changes), the new card animates in.

import { onUpdate } from '/core/state-client.js';
import { timeAgo, phaseClass, escapeHtml } from '/core/utils.js';

function renderCommit(c, isHead) {
  const cls = ['commit', `commit--${c.commitType || 'other'}`];
  if (isHead) cls.push('commit--new');
  const phase = c.phaseRaw ? `<span class="commit__phase ${phaseClass(c.phaseFamily)}">${escapeHtml(c.phaseRaw)}</span>` : '';
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
          <span class="commit__type">[${escapeHtml(c.tag || c.commitType)}]</span>
          <span class="commit__sha">#${escapeHtml(c.shortSha)}</span>
          ${phase}
          ${badge}
        </div>
        <div class="commit__subject">${escapeHtml(c.subject || '')}</div>
        <div class="commit__meta">
          <span>${escapeHtml(c.author || '')}</span>
          <span>· ${timeAgo(c.timestamp, { short: true })} ago</span>
          ${delta}
        </div>
      </div>
    </article>
  `;
}

export function mountCommitFeed(container) {
  container.innerHTML = `
    <div class="panel-title">
      <span>Commits<span class="panel-title__suffix" id="feed-suffix"></span></span>
      <span class="panel-title__meta" id="feed-count">—</span>
    </div>
    <div class="panel-body" id="feed-body">
      <div class="loading">waiting for first commit…</div>
    </div>
  `;
  const $body   = container.querySelector('#feed-body');
  const $count  = container.querySelector('#feed-count');
  const $suffix = container.querySelector('#feed-suffix');

  let lastHeadSha = null;
  let lastSig = null;

  onUpdate((state) => {
    if (!state || !Array.isArray(state.commits) || state.commits.length === 0) return;
    const commits = state.commits;
    const headSha = commits[0].sha;

    // Suffix shows the repo + branch identity — used to live in the removed
    // header bar.
    const branch = (state.head && state.head.branch) || 'main';
    $suffix.textContent = `(VOTV_MP / ${branch})`;

    // git log is deterministic given the same HEAD SHA and slice size, so
    // (sha, length) is a sufficient signature to skip re-render on idle ticks.
    const sig = `${headSha}|${commits.length}`;
    if (sig === lastSig) return;
    lastSig = sig;

    const isNew = headSha !== lastHeadSha;
    lastHeadSha = headSha;
    $count.textContent = `${commits.length} loaded`;
    $body.innerHTML = commits.map((c, i) => renderCommit(c, isNew && i === 0)).join('');

    // Snap to top so the freshly-arrived commit is the first thing visible.
    // Stays there until the next commit arrives.
    $body.scrollTop = 0;
  });
}
