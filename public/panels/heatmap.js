// 7-day x 24-hour heatmap. dayOffset 0 = today (top row), 6 = 6 days ago (bottom row).
// Cells colored by intensity (0-4 GitHub levels). The dominant commit type tints the cell.

import { onUpdate } from '/core/state-client.js';

const DAY_LABELS = ['Today', 'Y-day', '−2d', '−3d', '−4d', '−5d', '−6d'];

function levelFor(count, max) {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.50) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

function dominantType(types) {
  let best = null, n = 0;
  for (const [k, v] of Object.entries(types)) {
    if (v > n) { best = k; n = v; }
  }
  return best;
}

export function mountHeatmap(container) {
  container.innerHTML = `
    <div class="panel-title">
      <span>Activity · 7d</span>
      <span class="panel-title__meta" id="heat-meta">—</span>
    </div>
    <div class="panel-body">
      <div class="heat">
        <div class="heat__caption" id="heat-caption">—</div>
        <div class="heat__grid">
          <div class="heat__day-labels" id="heat-days"></div>
          <div class="heat__rows" id="heat-rows"></div>
        </div>
        <div class="heat__hours">
          <div></div>
          <div class="heat__hours-axis">
            ${Array.from({length: 24}, (_, h) => `<span>${h % 6 === 0 ? h : ''}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  const $rows = container.querySelector('#heat-rows');
  const $days = container.querySelector('#heat-days');
  const $cap  = container.querySelector('#heat-caption');
  const $meta = container.querySelector('#heat-meta');

  $days.innerHTML = DAY_LABELS.map(l => `<div>${l}</div>`).join('');

  let lastSig = null;

  onUpdate((state) => {
    if (!state || !state.heatmap) return;
    const hm = state.heatmap;

    // Signature: hour bucket + max + cell coordinates. Skips re-renders when the
    // 168-cell DOM would not visibly change.
    const cellPart = hm.cells.map(c => `${c.dayOffset}:${c.hour}:${c.count}`).join(',');
    const sig = `${new Date().getHours()}|${hm.maxCount}|${cellPart}`;
    if (sig === lastSig) return;
    lastSig = sig;

    $meta.textContent = `max ${hm.maxCount}/hr`;
    $cap.textContent  = `hours 0–23 · ${hm.cells.length} active hour-cells`;

    // Build a sparse cell lookup: key dayOffset:hour
    const lookup = new Map();
    for (const c of hm.cells) lookup.set(`${c.dayOffset}:${c.hour}`, c);

    const rowsHtml = [];
    for (let d = 0; d < hm.windowDays; d++) {
      const cells = [];
      for (let h = 0; h < 24; h++) {
        const cell = lookup.get(`${d}:${h}`);
        if (!cell) { cells.push(`<div class="heat__cell l-0"></div>`); continue; }
        const lvl = levelFor(cell.count, hm.maxCount);
        const type = dominantType(cell.types);
        const tcls = (type && type !== 'other' && lvl >= 3) ? ` t-${type}` : '';
        cells.push(`<div class="heat__cell l-${lvl}${tcls}" title="${cell.count} @ ${h}:00"></div>`);
      }
      rowsHtml.push(`<div class="heat__row">${cells.join('')}</div>`);
    }
    $rows.innerHTML = rowsHtml.join('');
  });
}
