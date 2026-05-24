// Thin async wrappers around git CLI invocations.
// One job: shell out to git and return raw stdout (caller parses).
// Uses execFile (no shell) for safety and Windows-spawn perf.

import { execFile } from 'node:child_process';

const GIT_BIN = process.env.GIT_BIN || 'git';
const MAX_BUFFER = 16 * 1024 * 1024; // 16 MB cap for huge diffs.

function run(args, { cwd, timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(GIT_BIN, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
    }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = (stderr || '').toString();
        return reject(err);
      }
      resolve(stdout.toString());
    });
  });
}

// HEAD SHA (40-char) + branch name in one fast call.
export async function readHead(cwd) {
  const branch = (await run(['symbolic-ref', '--short', 'HEAD'], { cwd })).trim();
  const sha    = (await run(['rev-parse', 'HEAD'],                { cwd })).trim();
  return { branch, sha, shortSha: sha.slice(0, 7) };
}

// Recent commits as a parse-friendly stream.
// Format uses ASCII unit separators to avoid collision with subject text.
const LOG_FMT = '%H%x1f%h%x1f%an%x1f%ae%x1f%ct%x1f%s';
const LOG_SEP = '\x1e'; // record separator

export async function readLog(cwd, n = 50) {
  const stdout = await run(['log', `-n${n}`, `--format=${LOG_FMT}%x1e`, '--no-color'], { cwd });
  if (!stdout.trim()) return [];
  return stdout.split(LOG_SEP).map(s => s.trim()).filter(Boolean).map(line => {
    const [sha, shortSha, author, email, ctStr, subject] = line.split('\x1f');
    return {
      sha,
      shortSha,
      author,
      authorEmail: email,
      timestamp: Number(ctStr),
      subject,
    };
  });
}

// Unified diff of a commit vs its parent (for HEAD diff panel).
export function readCommitDiff(cwd, sha) {
  return run(['show', '--no-color', '--unified=3', '--format=', sha], { cwd, timeoutMs: 15000 });
}

// Working-tree diff: unstaged + staged combined (HEAD vs working tree).
export function readWorkingTreeDiff(cwd) {
  return run(['diff', '--no-color', '--unified=3', 'HEAD'], { cwd, timeoutMs: 10000 });
}

// Porcelain status — single line per file, parseable.
// Format: "XY path" where X=index status, Y=worktree status.
export async function readStatus(cwd) {
  const stdout = await run(['status', '--porcelain=v1', '-z'], { cwd });
  if (!stdout) return [];
  const entries = [];
  // -z uses NUL separators; renames split into two NUL-terminated paths.
  const parts = stdout.split('\0');
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i];
    if (!rec) continue;
    const x = rec[0], y = rec[1];
    const filePath = rec.slice(3);
    let renamedFrom = null;
    if (x === 'R' || x === 'C') {
      renamedFrom = parts[i + 1] || null;
      i += 1;
    }
    entries.push({ x, y, path: filePath, renamedFrom });
  }
  return entries;
}

// Numstat for a commit (added/removed per file) — used for commit feed totals.
export async function readNumstat(cwd, sha) {
  const stdout = await run(['show', '--numstat', '--format=', '--no-color', sha], { cwd });
  return stdout.trim().split('\n').filter(Boolean).map(line => {
    const [addStr, delStr, file] = line.split('\t');
    return {
      path: file,
      linesAdded: addStr === '-' ? 0 : Number(addStr),
      linesRemoved: delStr === '-' ? 0 : Number(delStr),
    };
  });
}
