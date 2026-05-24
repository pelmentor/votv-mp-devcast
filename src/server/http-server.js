import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSseHub } from './sse-hub.js';
import { startWatcher } from '../poller/watcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

const PORT = Number(process.env.PORT) || 7842;
const SISTER_REPO = process.env.SISTER_REPO || 'D:\\Projects\\Programming\\VOTV_MP';
const POLL_MS = Number(process.env.POLL_MS) || 2500;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

let currentState = { status: 'initializing', schemaVersion: 1, generatedAt: Math.floor(Date.now() / 1000) };
const sseHub = createSseHub();

function noStoreHeaders(extra = {}) {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...extra,
  };
}

async function serveStatic(req, res) {
  // Strip query string, default '/' -> '/index.html'
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  // Resolve safely within PUBLIC_DIR
  const fsPath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!fsPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, noStoreHeaders()); res.end('Forbidden'); return;
  }

  try {
    const data = await fs.readFile(fsPath);
    const ext = path.extname(fsPath).toLowerCase();
    const ct = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, noStoreHeaders({ 'Content-Type': ct }));
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') { res.writeHead(404, noStoreHeaders()); res.end('Not found'); }
    else { res.writeHead(500, noStoreHeaders()); res.end('Internal error'); }
  }
}

function serveState(req, res) {
  res.writeHead(200, noStoreHeaders({ 'Content-Type': MIME['.json'] }));
  res.end(JSON.stringify(currentState));
}

function serveEvents(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  sseHub.add(res);
  // Push current state immediately so the client doesn't wait a full poll cycle.
  sseHub.sendOne(res, currentState);
  req.on('close', () => sseHub.remove(res));
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405, noStoreHeaders()); res.end('Method not allowed'); return;
  }
  const url = req.url.split('?')[0];
  if (url === '/state')  return serveState(req, res);
  if (url === '/events') return serveEvents(req, res);
  return serveStatic(req, res);
});

server.on('clientError', (err, socket) => {
  try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch {}
});

process.on('unhandledRejection', (err) => {
  console.error('[devcast] unhandledRejection:', err);
});

server.listen(PORT, () => {
  console.log(`[devcast] listening http://localhost:${PORT}/`);
  console.log(`[devcast] sister repo: ${SISTER_REPO}`);
  console.log(`[devcast] poll interval: ${POLL_MS}ms`);

  startWatcher({
    sisterRepo: SISTER_REPO,
    pollMs: POLL_MS,
    onState: (state) => {
      currentState = state;
      sseHub.broadcast(state);
    },
    onError: (err) => {
      console.error('[devcast] watcher error:', err.message);
    },
  });
});
