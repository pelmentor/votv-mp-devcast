// Manages connected EventSource clients and broadcasts JSON snapshots.
// One job: keep a Set of response streams, fan out writes.

export function createSseHub() {
  const clients = new Set();
  let lastEventId = 0;

  function formatEvent(payload) {
    lastEventId += 1;
    return `id: ${lastEventId}\ndata: ${JSON.stringify(payload)}\n\n`;
  }

  function safeWrite(res, text) {
    try {
      if (res.writableEnded || res.destroyed) return false;
      return res.write(text);
    } catch {
      return false;
    }
  }

  return {
    add(res) {
      clients.add(res);
    },
    remove(res) {
      clients.delete(res);
    },
    sendOne(res, payload) {
      safeWrite(res, formatEvent(payload));
    },
    broadcast(payload) {
      const wire = formatEvent(payload);
      for (const res of clients) {
        if (!safeWrite(res, wire)) clients.delete(res);
      }
    },
    size() {
      return clients.size;
    },
  };
}
