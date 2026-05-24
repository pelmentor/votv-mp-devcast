// Parses commit subjects into structured tag/phase/severity metadata.
// One job: text -> structured fields. No I/O, no git calls.

// Bracket prefix -> canonical commit type.
// Adding a new tag is a one-line edit. Unknown tags fall through to 'other'.
const TAG_MAP = {
  wire:      'wire',
  audit:     'audit',
  research:  'research',
  docs:      'docs',
  doc:       'docs',
  coop:      'coop',
  puppet:    'coop',
  grab:      'coop',
  net:       'coop',
  bug:       'bug',
  bug2:      'bug',
  fix:       'bug',
  harness:   'tooling',
  tools:     'tooling',
  dev:       'tooling',
  standalone:'tooling',
  ue_wrap:   'tooling',
  'rules+test': 'meta',
  meta:      'meta',
  scope:     'meta',
};

export function extractTag(subject) {
  const m = /^\[([^\]]+)\]/.exec(subject);
  if (!m) return { tag: null, commitType: 'other' };
  const raw = m[1].trim().toLowerCase();
  return { tag: raw, commitType: TAG_MAP[raw] || 'other' };
}

// Phase detection — multiple known shapes from real VOTV_MP history.
//   "Phase 5N Stream B"   -> { full: "Phase 5N Stream B", raw: "5N" }
//   "Phase 5S0 Inc1"      -> { full: "Phase 5S0 Inc1",   raw: "5S0" }
//   "Gap I-1"             -> { full: "Gap I-1",          raw: "Gap I-1" }
//   "Bug B" / "Bug C"     -> { full: "Bug B",            raw: "Bug B" }
export function extractPhase(subject) {
  const phaseRe = /Phase\s+([\w/.-]+)(?:\s+(Stream\s+\w+|Inc\d+|\w+))?/i;
  const gapRe   = /\b(Gap\s+[\w-]+)\b/i;
  const bugRe   = /\b(Bug\s+[A-Z](?:\/[A-Z])?)\b/;

  let m = phaseRe.exec(subject);
  if (m) {
    const raw = m[1];
    const tail = m[2] ? ` ${m[2]}` : '';
    return { full: `Phase ${raw}${tail}`.trim(), raw, family: raw.replace(/[0-9].*/, '') || raw };
  }
  m = gapRe.exec(subject);
  if (m) return { full: m[1], raw: m[1], family: 'Gap' };
  m = bugRe.exec(subject);
  if (m) return { full: m[1], raw: m[1], family: 'Bug' };
  return { full: null, raw: null, family: null };
}

// Audit subjects often contain "N issues" and severities CRITICAL/IMPORTANT.
export function extractAuditMeta(subject) {
  const issueM = /(\d+)\s+issues?/i.exec(subject);
  const issueCount = issueM ? Number(issueM[1]) : null;
  let severity = null;
  if (/CRITICAL/.test(subject))      severity = 'CRITICAL';
  else if (/IMPORTANT/.test(subject)) severity = 'IMPORTANT';
  return { issueCount, severity };
}

// Full enrichment for one CommitRecord (mutates + returns).
export function enrichCommit(commit) {
  const { tag, commitType } = extractTag(commit.subject);
  commit.tag = tag;
  commit.commitType = commitType;

  const phase = extractPhase(commit.subject);
  commit.phase = phase.full;
  commit.phaseRaw = phase.raw;
  commit.phaseFamily = phase.family;

  if (commitType === 'audit') {
    const am = extractAuditMeta(commit.subject);
    commit.issueCount = am.issueCount;
    commit.severity = am.severity;
  } else {
    commit.issueCount = null;
    commit.severity = null;
  }
  return commit;
}

// Forward-fill phase across an array of commits (oldest -> newest order in chronological time;
// the input array is newest-first as `git log` returns). We walk newest -> oldest and
// REMEMBER the last non-null phase, then assign it to entries that came AFTER it chronologically
// (which means BEFORE it in array index for the newest-first array).
// Simpler: walk oldest -> newest and forward-fill; reverse twice.
export function propagatePhases(commitsNewestFirst) {
  const reversed = commitsNewestFirst.slice().reverse(); // now oldest -> newest
  let active = null;
  for (const c of reversed) {
    if (c.phase) active = { full: c.phase, raw: c.phaseRaw, family: c.phaseFamily };
    else if (active) {
      c.phase = active.full;
      c.phaseRaw = active.raw;
      c.phaseFamily = active.family;
    }
  }
  return reversed.reverse();
}
