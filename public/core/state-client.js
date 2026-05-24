// Subscribes to /events (SSE) and dispatches CustomEvent('dashboard:update', { detail: state })
// on the window. Panels listen for that event and re-render.
// Also handles initial /state fetch so the first paint doesn't wait for the SSE handshake.

const EVENT = 'dashboard:update';
let currentState = null;

export function getCurrentState() { return currentState; }

export function onUpdate(handler) {
  window.addEventListener(EVENT, (e) => handler(e.detail));
  if (currentState) handler(currentState);
}

function publish(state) {
  currentState = state;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: state }));
}

async function fetchInitial() {
  try {
    const res = await fetch('/state', { cache: 'no-store' });
    if (!res.ok) return;
    const state = await res.json();
    publish(state);
  } catch {}
}

export function connect() {
  fetchInitial();
  const src = new EventSource('/events');
  let wasErrored = false;
  src.onmessage = (e) => {
    try { publish(JSON.parse(e.data)); }
    catch (err) { console.warn('[devcast] bad SSE payload', err); }
  };
  // Dedupe the disconnect log so a flaky network doesn't spam the console every retry.
  src.onerror = () => {
    if (!wasErrored) {
      console.warn('[devcast] SSE disconnected, will auto-reconnect');
      wasErrored = true;
    }
  };
  src.onopen = () => {
    if (wasErrored) {
      console.info('[devcast] SSE reconnected');
      wasErrored = false;
    }
  };
}
