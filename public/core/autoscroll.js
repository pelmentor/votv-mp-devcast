// Smooth one-way DOWN auto-scroll for a scrollable element.
// When the scroller reaches the bottom it dwells (so viewers can read the
// tail), then jumps back to the top and starts over — never animates upward,
// so the panel always reveals fresh content top-to-bottom.
//
// Memory + perf:
//   - Single requestAnimationFrame loop per attachment, self-cancels via
//     `el.isConnected` if the element ever detaches.
//   - When paused at end-of-content or idle (content fits in viewport), the
//     loop switches from 60 Hz rAF to a one-shot setTimeout so it doesn't
//     burn frames doing nothing.
//   - Float `pos` accumulator survives sub-pixel speeds. Reset on every
//     content change so a new commit's diff starts from the top.

export function attachAutoScroll(el, {
  pxPerSec = 28,        // scroll speed (a typical diff line is ~22px so ~1.3 lines/sec)
  pauseMs  = 1400,      // dwell at the bottom before jumping back to top
  topDwellMs = 600,     // brief pause at the top before starting down again
  minOverflowPx = 8,    // only animate when there's at least this much overflow
  idleCheckMs = 500,    // when no overflow, how often to wake up and re-check
} = {}) {
  let rafId       = null;
  let timeoutId   = null;
  let pos         = 0;
  let lastTs      = 0;
  let pausedUntil = 0;
  let stopped     = false;

  function clearScheduled() {
    if (rafId     != null) { cancelAnimationFrame(rafId); rafId = null; }
    if (timeoutId != null) { clearTimeout(timeoutId);     timeoutId = null; }
  }
  function scheduleRaf() {
    if (stopped || rafId != null) return;
    if (timeoutId != null) { clearTimeout(timeoutId); timeoutId = null; }
    rafId = requestAnimationFrame(tick);
  }
  function scheduleTimeout(ms) {
    if (stopped || timeoutId != null) return;
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    timeoutId = setTimeout(() => { timeoutId = null; tick(performance.now()); }, ms);
  }

  function tick(ts) {
    if (stopped) return;
    if (!el.isConnected) { stop(); return; }
    rafId = null;

    // Clamp dt so a backgrounded tab returning with a huge timestamp gap
    // doesn't catapult us past the bottom in one frame.
    if (!lastTs) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.1);
    lastTs = ts;

    const maxScroll = el.scrollHeight - el.clientHeight;

    // No overflow: park at top, sleep with a low-frequency timeout that polls
    // for content growth. No rAF spin.
    if (maxScroll <= minOverflowPx) {
      if (pos !== 0 || el.scrollTop !== 0) { pos = 0; el.scrollTop = 0; }
      scheduleTimeout(idleCheckMs);
      return;
    }

    // Pause window (after reaching bottom, or fresh-from-reset top dwell):
    // sleep until pause ends. No rAF spin during dwell.
    if (ts < pausedUntil) {
      scheduleTimeout(Math.max(16, pausedUntil - ts));
      return;
    }

    // End-of-content dwell complete -> jump to top, brief top dwell, then resume.
    if (pos >= maxScroll) {
      pos = 0;
      el.scrollTop = 0;
      pausedUntil = ts + topDwellMs;
      scheduleTimeout(topDwellMs);
      return;
    }

    // Active scroll. Advance pos by the time-scaled speed.
    pos += pxPerSec * dt;
    if (pos >= maxScroll) {
      pos = maxScroll;
      el.scrollTop = Math.floor(pos);
      pausedUntil = ts + pauseMs;     // dwell at bottom
      scheduleTimeout(pauseMs);
      return;
    }
    el.scrollTop = Math.floor(pos);
    scheduleRaf();
  }

  function start() {
    if (stopped) return;
    if (rafId != null || timeoutId != null) return;
    lastTs = 0;
    scheduleRaf();
  }
  function stop() {
    stopped = true;
    clearScheduled();
  }
  // Called by panels on every content render. Restarts the scroll from the top
  // with a brief top dwell so a new commit's diff is shown from the beginning.
  function reset() {
    pos = 0;
    lastTs = 0;
    if (el.isConnected) el.scrollTop = 0;
    pausedUntil = performance.now() + topDwellMs;
    // Wake up the loop if it was sleeping in a long idle/dwell timeout.
    clearScheduled();
    if (!stopped) scheduleTimeout(topDwellMs);
  }

  start();
  return { start, stop, reset };
}
