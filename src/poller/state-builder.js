// Assembles parsed git data into the DashboardState JSON the render layer consumes.
// One job: pure data composition. No I/O.

import { enrichCommit, propagatePhases } from './commit-parser.js';
import { parseDiff } from './diff-parser.js';

const SCHEMA_VERSION = 1;

// Heatmap window: 7 days * 24 hours, populated sparsely.
const HEATMAP_DAYS = 7;

function buildFileTreeEntries(numstat, statusEntries) {
  // Map path -> {linesAdded, linesRemoved, status}
  // numstat covers committed-diff paths; statusEntries covers working-tree paths.
  // For HEAD commit, status comes from the diff itself (we don't have it here cheaply),
  // so use 'M' by default unless numstat hints a deletion (added=0 && removed>0 isn't conclusive).
  // The actual A/M/D status is in diff.files[].status — buildFileTree() prefers that source.
  const map = new Map();
  for (const ns of numstat) {
    map.set(ns.path, { path: ns.path, status: 'M', linesAdded: ns.linesAdded, linesRemoved: ns.linesRemoved });
  }
  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function buildFileTreeFromDiff(diff) {
  return diff.files
    .map(f => ({
      path: f.path,
      status: f.status,
      linesAdded: f.linesAdded,
      linesRemoved: f.linesRemoved,
      depth: f.path.split('/').length - 1,
      isDir: false,
      renamedFrom: f.renamedFrom,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function buildHeatmap(commits) {
  // dayOffset 0 = today, ..., HEATMAP_DAYS-1 = (windowDays-1) days ago.
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
  const cellMap = new Map(); // key: dayOffset:hour

  for (const c of commits) {
    const t = c.timestamp;
    const dayStart = new Date(t * 1000);
    dayStart.setHours(0, 0, 0, 0);
    const dayOffset = Math.round((today - dayStart.getTime() / 1000) / 86400);
    if (dayOffset < 0 || dayOffset >= HEATMAP_DAYS) continue;
    const hour = new Date(t * 1000).getHours();
    const key = `${dayOffset}:${hour}`;
    let cell = cellMap.get(key);
    if (!cell) {
      cell = { dayOffset, hour, count: 0, types: { wire: 0, audit: 0, research: 0, other: 0 } };
      cellMap.set(key, cell);
    }
    cell.count += 1;
    const bucket = (cell.types[c.commitType] !== undefined) ? c.commitType : 'other';
    cell.types[bucket] += 1;
  }
  const cells = Array.from(cellMap.values());
  const maxCount = cells.reduce((m, c) => Math.max(m, c.count), 0);
  return { windowDays: HEATMAP_DAYS, cells, maxCount };
}

export function buildState({ head, commits, commitDiffRaw, workingTreeDiffRaw, statusEntries }) {
  // Enrich commits with tag/phase/severity, then propagate phases across the feed.
  for (const c of commits) enrichCommit(c);
  propagatePhases(commits);

  const headCommit = commits[0] || null;
  const headDiff = parseDiff(commitDiffRaw || '');
  const workingTreeDiff = parseDiff(workingTreeDiffRaw || '');

  // Annotate each commit with its diff totals from numstat-equivalent (we lift from headDiff for HEAD only).
  if (headCommit) {
    headCommit.linesAdded = headDiff.totalAdded;
    headCommit.linesRemoved = headDiff.totalRemoved;
  }

  const headFileTree   = buildFileTreeFromDiff(headDiff);
  const workingTreeFileTree = buildFileTreeFromDiff(workingTreeDiff);

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: Math.floor(Date.now() / 1000),
    head: headCommit ? {
      branch: head.branch,
      sha: head.sha,
      shortSha: head.shortSha,
      phase: headCommit.phase,
      phaseRaw: headCommit.phaseRaw,
      phaseFamily: headCommit.phaseFamily,
      commitType: headCommit.commitType,
      tag: headCommit.tag,
      subject: headCommit.subject,
      author: headCommit.author,
      lastCommitAt: headCommit.timestamp,
    } : {
      branch: head.branch,
      sha: head.sha,
      shortSha: head.shortSha,
      phase: null, phaseRaw: null, phaseFamily: null,
      commitType: 'other', tag: null, subject: '', author: null, lastCommitAt: null,
    },
    commits,
    headDiff: {
      commitSha: headCommit ? headCommit.sha : null,
      files: headDiff.files,
      totalAdded: headDiff.totalAdded,
      totalRemoved: headDiff.totalRemoved,
      truncated: headDiff.truncated,
    },
    workingTreeDiff: {
      files: workingTreeDiff.files,
      totalAdded: workingTreeDiff.totalAdded,
      totalRemoved: workingTreeDiff.totalRemoved,
      truncated: workingTreeDiff.truncated,
      isDirty: workingTreeDiff.files.length > 0 || statusEntries.length > 0,
      statusCount: statusEntries.length,
    },
    fileTree: {
      commitSha: headCommit ? headCommit.sha : null,
      entries: headFileTree,
    },
    workingTreeFileTree: {
      entries: workingTreeFileTree,
    },
    heatmap: buildHeatmap(commits),
  };
}
