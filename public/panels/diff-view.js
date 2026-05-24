// Renders a unified diff in GitHub style. Reused for both the working-tree diff
// and the HEAD commit diff — same DOM, different state slice via `dataKey`.

import { onUpdate } from '/core/state-client.js';

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
}

function renderHunk(hunk) {
  // Walk each line, tracking old/new line numbers off the @@ header.
  // Header form: @@ -oldStart,oldLen +newStart,newLen @@
  let oldNo = 0, newNo = 0;
  const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(hunk.header);
  if (m) { oldNo = Number(m[1]); newNo = Number(m[2]); }

  const html = [];
  html.push(`<div class="hunk__header">${escape(hunk.header)}</div>`);
  for (const line of hunk.lines) {
    let gutter;
    if (line.type === 'added')        { gutter = '+'; }
    else if (line.type === 'removed') { gutter = '−'; }
    else if (line.type === 'context') { gutter = ' '; }
    else                              { gutter = '\\'; }

    if (line.type === 'meta') {
      html.push(`<div class="hunk__line t-meta"><div class="hunk__text">${escape(line.text)}</div></div>`);
      continue;
    }
    html.push(`
      <div class="hunk__line t-${line.type}">
        <div class="hunk__gutter">${gutter}</div>
        <div class="hunk__text">${escape(line.text)}</div>
      </div>
    `);
  }
  return `<div class="hunk">${html.join('')}</div>`;
}

function renderFile(file) {
  const status = file.status || 'M';
  return `
    <div class="diff-file">
      <header class="diff-file__header">
        <span class="diff-file__status s-${status}" title="${status}">${status}</span>
        <span class="diff-file__path">${escape(file.path)}</span>
        <span class="diff-file__delta"><span class="a">+${file.linesAdded}</span> <span class="r">−${file.linesRemoved}</span></span>
      </header>
      ${file.hunks.map(renderHunk).join('')}
    </div>
  `;
}

export function mountDiffView(container, { dataKey, label, emptyMessage }) {
  container.innerHTML = `
    <div class="panel-title">
      <span>${escape(label)}</span>
      <span class="panel-title__meta" data-meta>—</span>
    </div>
    <div class="panel-body" data-body>
      <div class="diff-empty">${escape(emptyMessage)}</div>
    </div>
  `;
  const $body = container.querySelector('[data-body]');
  const $meta = container.querySelector('[data-meta]');

  let lastSig = null;

  onUpdate((state) => {
    if (!state) return;
    const slice = state[dataKey];
    if (!slice) return;

    const sig = `${slice.commitSha || ''}|${slice.totalAdded}|${slice.totalRemoved}|${(slice.files || []).map(f => f.path).join(',')}`;
    if (sig === lastSig) return;
    lastSig = sig;

    // Working-tree dirty indicator: shade the panel title yellow when dirty.
    if (dataKey === 'workingTreeDiff') {
      const isDirty = slice.isDirty || (slice.files && slice.files.length > 0);
      container.classList.toggle('is-dirty', !!isDirty);
      container.querySelector('.panel-title').classList.toggle('is-dirty', !!isDirty);
    }

    if (!slice.files || slice.files.length === 0) {
      $body.innerHTML = `<div class="diff-empty">${escape(emptyMessage)}</div>`;
      $meta.textContent = '—';
      return;
    }
    $meta.innerHTML = `<span style="color:var(--diff-add-stripe)">+${slice.totalAdded}</span> <span style="color:var(--diff-rem-stripe)">−${slice.totalRemoved}</span> · ${slice.files.length} file${slice.files.length === 1 ? '' : 's'}`;

    const fragments = slice.files.map(renderFile);
    if (slice.truncated) fragments.push(`<div class="diff-truncated">diff truncated at line cap</div>`);
    $body.innerHTML = fragments.join('');

    // Flash the panel border so a viewer notices the change.
    container.classList.remove('flash');
    void container.offsetWidth; // force reflow so the animation restarts
    container.classList.add('flash');
  });
}
