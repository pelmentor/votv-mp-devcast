// Flat list of files changed in HEAD commit, with status icon + line delta.
// (We render the working-tree file list when WT is dirty, falling back to HEAD otherwise.)

import { onUpdate } from '/core/state-client.js';
import { escapeHtml } from '/core/utils.js';

function renderEntries(entries) {
  return entries.map(e => `
    <div class="tree__entry">
      <span class="tree__status s-${e.status}" title="${e.status}">${e.status}</span>
      <span class="tree__path" title="${escapeHtml(e.path)}">${escapeHtml(e.path)}</span>
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

  let lastSig = null;

  onUpdate((state) => {
    if (!state) return;
    const wt = state.workingTreeFileTree;
    const head = state.fileTree;
    let entries, source, sigKey;
    if (wt && wt.entries && wt.entries.length) {
      entries = wt.entries; source = 'working tree';
      sigKey = 'wt';
    } else if (head && head.entries && head.entries.length) {
      entries = head.entries; source = `HEAD ${head.commitSha ? head.commitSha.slice(0, 7) : ''}`;
      sigKey = `head:${head.commitSha || ''}`;
    } else {
      entries = []; source = '—'; sigKey = 'empty';
    }
    const sig = `${sigKey}|${entries.length}|` + entries.map(e => `${e.path}:${e.status}:${e.linesAdded}:${e.linesRemoved}`).join(',');
    if (sig === lastSig) return;
    lastSig = sig;

    $source.textContent = source;
    if (entries.length === 0) {
      $body.innerHTML = `<div class="loading">no changes</div>`;
      return;
    }
    $body.innerHTML = renderEntries(entries);
  });
}
