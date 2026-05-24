// Parses unified diff text (output of `git show` or `git diff`) into structured hunks.
// One job: raw diff text -> { files, totalAdded, totalRemoved, truncated }.
// Caps total emitted lines so the render layer cannot be killed by a 50k-line diff.

const MAX_DIFF_LINES = 2000;

const FILE_HEADER_RE = /^diff --git a\/(.+?) b\/(.+)$/;
const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseDiff(rawText, { maxLines = MAX_DIFF_LINES } = {}) {
  const files = [];
  let totalAdded = 0;
  let totalRemoved = 0;
  let emittedLines = 0;
  let truncated = false;

  let curFile = null;
  let curHunk = null;
  let pendingStatus = 'M';
  let pendingDeleted = false;
  let pendingAdded = false;
  let pendingRenamedFrom = null;

  const lines = rawText.split('\n');

  function pushFile(newPath, oldPath) {
    if (curFile) files.push(curFile);
    curFile = {
      path: newPath,
      oldPath: oldPath !== newPath ? oldPath : null,
      status: pendingAdded ? 'A' : pendingDeleted ? 'D' : pendingRenamedFrom ? 'R' : 'M',
      renamedFrom: pendingRenamedFrom,
      linesAdded: 0,
      linesRemoved: 0,
      hunks: [],
    };
    curHunk = null;
    pendingStatus = 'M';
    pendingDeleted = false;
    pendingAdded = false;
    pendingRenamedFrom = null;
  }

  function pushHunk(header) {
    curHunk = { header, lines: [] };
    if (curFile) curFile.hunks.push(curHunk);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fm = FILE_HEADER_RE.exec(line);
    if (fm) {
      // Lookahead a few lines to pick up new/deleted/rename markers before the @@ block.
      let oldPath = fm[1];
      let newPath = fm[2];
      pendingAdded = false;
      pendingDeleted = false;
      pendingRenamedFrom = null;
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const lk = lines[j];
        if (lk.startsWith('@@') || lk.startsWith('diff --git')) break;
        if (lk.startsWith('new file mode')) pendingAdded = true;
        else if (lk.startsWith('deleted file mode')) pendingDeleted = true;
        else if (lk.startsWith('rename from ')) pendingRenamedFrom = lk.slice('rename from '.length);
        else if (lk.startsWith('rename to '))    newPath = lk.slice('rename to '.length);
      }
      pushFile(newPath, oldPath);
      continue;
    }

    const hm = HUNK_HEADER_RE.exec(line);
    if (hm) {
      if (!curFile) continue; // defensive
      pushHunk(line);
      continue;
    }

    if (!curHunk) continue; // skip pre-hunk noise (index lines, mode lines)

    // Classify and COUNT first; only THEN decide whether to push the line into
    // the rendered hunk. This way file/total +/- counters stay honest even when
    // the line-cap kicks in mid-diff (otherwise the panel header would lie).
    let type;
    let text;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      type = 'added'; text = line.slice(1);
      curFile.linesAdded += 1; totalAdded += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      type = 'removed'; text = line.slice(1);
      curFile.linesRemoved += 1; totalRemoved += 1;
    } else if (line.startsWith(' ')) {
      type = 'context'; text = line.slice(1);
    } else if (line.startsWith('\\')) {
      // "\ No newline at end of file" marker — keep as a context-style hint.
      type = 'meta'; text = line;
    } else {
      continue;
    }

    if (emittedLines >= maxLines) { truncated = true; continue; }
    curHunk.lines.push({ type, text });
    emittedLines += 1;
  }

  if (curFile) files.push(curFile);

  return { files, totalAdded, totalRemoved, truncated };
}
