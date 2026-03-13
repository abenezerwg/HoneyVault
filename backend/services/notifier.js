/**
 * notifier.js
 * Broadcasts real-time events to all connected WebSocket clients
 */

let _wss = null;

function setWss(wss) {
  _wss = wss;
}

function broadcast(data) {
  if (!_wss) return;

  const message = JSON.stringify({
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
  });

  let sent = 0;
  _wss.clients.forEach((client) => {
    const WebSocket = require('ws');
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sent++;
    }
  });

  console.log(`[WS] Broadcast "${data.type}" to ${sent} clients`);
}

module.exports = { setWss, broadcast };
