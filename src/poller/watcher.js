// Polls the sister repo for git activity and rebuilds the dashboard state.
// One job: orchestrate the read -> parse -> build -> emit cycle.
// HEAD-SHA change OR working-tree (status hash) change triggers a rebuild.

import crypto from 'node:crypto';
import {
  readHead, readLog, readCommitDiff, readWorkingTreeDiff, readStatus,
} from './git-reader.js';
import { buildState } from './state-builder.js';

const LOG_COUNT = 50;

function hashStatus(entries) {
  return crypto.createHash('sha1')
    .update(entries.map(s => `${s.x}${s.y} ${s.path}`).join('\n'))
    .digest('hex');
}

export function startWatcher({ sisterRepo, pollMs, onState, onError }) {
  let lastHeadSha = null;
  let lastStatusHash = null;
  let cycling = false;

  // Single source of truth: detect change AND rebuild in one function so the
  // last-known cursors are always advanced atomically. Prevents the "startup
  // rebuild + immediate wt-rebuild" double-fire pattern caused by separate
  // cursor management between tick() and rebuild().
  async function cycle(forceReason) {
    if (cycling) return;
    cycling = true;
    try {
      const [head, status] = await Promise.all([
        readHead(sisterRepo),
        readStatus(sisterRepo),
      ]);
      const statusHash = hashStatus(status);
      const headChanged   = head.sha !== lastHeadSha;
      const statusChanged = statusHash !== lastStatusHash;

      if (!forceReason && !headChanged && !statusChanged) return;

      const [commits, commitDiffRaw, workingTreeDiffRaw] = await Promise.all([
        readLog(sisterRepo, LOG_COUNT),
        head.sha ? readCommitDiff(sisterRepo, head.sha) : Promise.resolve(''),
        readWorkingTreeDiff(sisterRepo),
      ]);

      const state = buildState({
        head, commits, commitDiffRaw, workingTreeDiffRaw, statusEntries: status,
      });
      onState(state);

      // Advance cursors only after a successful emit, so a failure leaves them
      // unchanged and the next tick retries.
      lastHeadSha = head.sha;
      lastStatusHash = statusHash;

      const reason = forceReason
        ? forceReason
        : (headChanged && statusChanged ? 'head+wt' : headChanged ? 'head' : 'wt');
      console.log(`[devcast] rebuild (${reason}) head=${head.shortSha} status=${status.length} commits=${commits.length}`);
    } catch (err) {
      onError(err);
    } finally {
      cycling = false;
    }
  }

  cycle('startup').catch(onError);
  const interval = setInterval(() => { cycle(); }, pollMs);
  return {
    stop() { clearInterval(interval); },
  };
}
