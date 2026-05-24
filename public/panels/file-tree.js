// Flat list of files changed in HEAD commit, with status icon + line delta.
// (We render the working-tree file list when WT is dirty, falling back to HEAD otherwise.)

import { onUpdate } from '/core/state-client.js';

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
}

function renderEntries(entries) {
  return entries.map(e => `
    <div class="tree__entry">
      <span class="tree__status s-${e.status}" title="${e.status}">${e.status}</span>
      <span class="tree__path" title="${escape(e.path)}">${escape(e.path)}</span>
      <span class="tree__delta"><span class="a">+${e.linesAdded}</span> <span class="r">−${e.linesRemoved}</span></span>
    </div>
  `).join('');
}

export function mountFileTree(container) {
  container.innerHTML = `
    <div class="panel-title">
      <span>Files</span>
      <span class="panel-title__meta" id="tree-source">—</span>
    </div>
    <div class="panel-body" id="tree-body">
      <div class="loading">no changes</div>
    </div>
  `;
  const $body   = container.querySelector('#tree-body');
  const $source = container.querySelector('#tree-source');

  onUpdate((state) => {
    if (!state) return;
    const wt = state.workingTreeFileTree;
    const head = state.fileTree;
    let entries, source;
    if (wt && wt.entries && wt.entries.length) {
      entries = wt.entries; source = 'working tree';
    } else if (head && head.entries && head.entries.length) {
      entries = head.entries; source = `HEAD ${head.commitSha ? head.commitSha.slice(0, 7) : ''}`;
    } else {
      entries = []; source = '—';
    }
    $source.textContent = source;
    if (entries.length === 0) {
      $body.innerHTML = `<div class="loading">no changes</div>`;
      return;
    }
    $body.innerHTML = renderEntries(entries);
  });
}
