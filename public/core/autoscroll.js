// Smooth infinite up-down scroll for a scrollable element.
// One requestAnimationFrame loop per attachment, automatically cancelled when
// the element detaches from the DOM (no leak even if a panel is rebuilt).

export function attachAutoScroll(el, {
  pxPerSec = 28,       // scroll speed (readable: a typical diff line is ~22px so ~1.3 lines/sec)
  pauseMs  = 1400,     // dwell time at each end before reversing
  minOverflowPx = 8,   // only animate when there's at least this much overflow
} = {}) {
  let rafId       = null;
  let direction   = 1;  // 1 = down, -1 = up
  let lastTs      = 0;
  let pausedUntil = 0;
  let stopped     = false;

  function tick(ts) {
    if (stopped) return;
    if (!el.isConnected) { stop(); return; }   // panel was torn down -> exit loop

    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    const maxScroll = el.scrollHeight - el.clientHeight;

    if (maxScroll <= minOverflowPx) {
      // No meaningful overflow; idle but keep loop alive so we resume when content grows.
      el.scrollTop = 0;
      rafId = requestAnimationFrame(tick);
      return;
    }
    if (ts < pausedUntil) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    // Use a float accumulator so slow speeds aren't lost to integer rounding.
    pos += direction * pxPerSec * dt;
    if (pos >= maxScroll) {
      pos = maxScroll;
      direction = -1;
      pausedUntil = ts + pauseMs;
    } else if (pos <= 0) {
      pos = 0;
      direction = 1;
      pausedUntil = ts + pauseMs;
    }
    el.scrollTop = pos;

    rafId = requestAnimationFrame(tick);
  }

  // Float position accumulator (el.scrollTop coerces to int, which loses sub-px motion at slow speeds).
  let pos = 0;

  function start() {
    if (stopped || rafId != null) return;
    lastTs = 0;
    rafId = requestAnimationFrame(tick);
  }
  function stop() {
    stopped = true;
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
  }
  function reset() {
    pos = 0;
    el.scrollTop = 0;
    direction = 1;
    lastTs = 0;
    pausedUntil = performance.now() + pauseMs;  // pause at the top before starting down
  }

  start();
  return { start, stop, reset };
}
