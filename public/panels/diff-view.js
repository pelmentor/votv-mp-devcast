// Renders a unified diff in GitHub style. Reused for both the working-tree diff
// and the HEAD commit diff — same DOM, different state slice via `dataKey`.

import { onUpdate } from '/core/state-client.js';
import { escapeHtml, timeAgo } from '/core/utils.js';

function renderHunk(hunk) {
  // Walk each line. Header form: @@ -oldStart,oldLen +newStart,newLen @@
  // (Line numbers are decorative — kept for parity with GitHub's diff view.)
  const html = [];
  html.push(`<div class="hunk__header">${escapeHtml(hunk.header)}</div>`);
  for (const line of hunk.lines) {
    let gutter;
    if (line.type === 'added')        { gutter = '+'; }
    else if (line.type === 'removed') { gutter = '−'; }
    else if (line.type === 'context') { gutter = ' '; }
    else                              { gutter = '\\'; }

    if (line.type === 'meta') {
      html.push(`<div class="hunk__line t-meta"><div class="hunk__text">${escapeHtml(line.text)}</div></div>`);
      continue;
    }
    html.push(`<div class="hunk__line t-${line.type}"><div class="hunk__gutter">${gutter}</div><div class="hunk__text">${escapeHtml(line.text)}</div></div>`);
  }
  return `<div class="hunk">${html.join('')}</div>`;
}

function renderFile(file) {
  const status = file.status || 'M';
  return `
    <div class="diff-file">
      <header class="diff-file__header">
        <span class="diff-file__status s-${status}" title="${status}">${status}</span>
        <span class="diff-file__path">${escapeHtml(file.path)}</span>
        <span class="diff-file__delta"><span class="a">+${file.linesAdded}</span> <span class="r">−${file.linesRemoved}</span></span>
      </header>
      ${file.hunks.map(renderHunk).join('')}
    </div>
  `;
}

// Build the parenthesized title suffix for the HEAD-diff panel from state.head.
// Returns empty string when not the HEAD panel or no head info present.
function buildHeadSuffix(state) {
  const h = state && state.head;
  if (!h) return '';
  const parts = [];
  if (h.shortSha)     parts.push(`#${h.shortSha}`);
  if (h.tag)          parts.push(`[${h.tag}]`);
  if (h.phaseRaw)     parts.push(h.phaseRaw);
  if (h.lastCommitAt) parts.push(timeAgo(h.lastCommitAt));
  return parts.length ? `(${parts.join(' · ')})` : '';
}

export function mountDiffView(container, { dataKey, label, emptyMessage, includeHeadSuffix = false }) {
  container.innerHTML = `
    <div class="panel-title">
      <span>${escapeHtml(label)}<span class="panel-title__suffix" data-suffix></span></span>
      <span class="panel-title__meta" data-meta>—</span>
    </div>
    <div class="panel-body" data-body>
      <div class="diff-empty">${escapeHtml(emptyMessage)}</div>
    </div>
  `;
  const $body   = container.querySelector('[data-body]');
  const $meta   = container.querySelector('[data-meta]');
  const $suffix = container.querySelector('[data-suffix]');

  let lastSig   = null;
  let lastState = null;

  function refreshSuffix() {
    if (!includeHeadSuffix) return;
    $suffix.textContent = buildHeadSuffix(lastState);
  }

  onUpdate((state) => {
    if (!state) return;
    lastState = state;
    refreshSuffix();

    const slice = state[dataKey];
    if (!slice) return;

    // Signature includes per-file deltas so a same-file-list edit that nets to
    // the same totals still re-renders.
    const filesPart = (slice.files || []).map(f => `${f.path}:${f.linesAdded}:${f.linesRemoved}`).join(',');
    const sig = `${slice.commitSha || ''}|${slice.totalAdded}|${slice.totalRemoved}|${filesPart}`;
    if (sig === lastSig) return;
    lastSig = sig;

    // Working-tree dirty indicator: shade the panel title yellow when dirty.
    if (dataKey === 'workingTreeDiff') {
      const isDirty = slice.isDirty || (slice.files && slice.files.length > 0);
      container.classList.toggle('is-dirty', !!isDirty);
      container.querySelector('.panel-title').classList.toggle('is-dirty', !!isDirty);
    }

    if (!slice.files || slice.files.length === 0) {
      $body.innerHTML = `<div class="diff-empty">${escapeHtml(emptyMessage)}</div>`;
      $meta.textContent = '—';
      return;
    }
    $meta.innerHTML = `<span style="color:var(--diff-add-stripe)">+${slice.totalAdded}</span> <span style="color:var(--diff-rem-stripe)">−${slice.totalRemoved}</span> · ${slice.files.length} file${slice.files.length === 1 ? '' : 's'}`;

    const fragments = slice.files.map(renderFile);
    if (slice.truncated) fragments.push(`<div class="diff-truncated">diff truncated at line cap</div>`);
    $body.innerHTML = fragments.join('');

    // Snap to top so the viewer sees the new content from line 1.
    // Stays put until the next update lands.
    $body.scrollTop = 0;

    // Flash the panel border so a viewer notices the change.
    // Animating opacity on a pseudo-element (see theme.css .panel::after) keeps this compositor-only.
    container.classList.remove('flash');
    void container.offsetWidth;
    container.classList.add('flash');
  });

  // Keep the "Nm ago" portion of the HEAD suffix fresh even between commits.
  // Cheap: one textContent write every 30s on one element.
  if (includeHeadSuffix) {
    setInterval(refreshSuffix, 30000);
  }
}
