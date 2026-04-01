require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const { initDb } = require('./db/client');
const { setWss } = require('./services/notifier');

const webhookRoutes = require('./routes/webhook');
const tokenRoutes = require('./routes/tokens');
const incidentRoutes = require('./routes/incidents');

const app = express();
const server = http.createServer(app);

// ─── WebSocket Server ─────────────────────────────────────────────────────────
const wss = new WebSocket.Server({ server, path: '/ws' });
setWss(wss);

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  ws.send(JSON.stringify({ type: 'connected', message: 'HoneyVault live feed active' }));

  ws.on('close', () => console.log('[WS] Client disconnected'));
  ws.on('error', (err) => console.error('[WS] Error:', err));
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'https://honey-vault.vercel.app',
      'https://honeyvault.vercel.app',
    ];
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Allow all origins temporarily for debugging
  },
  credentials: true,
}));

// IMPORTANT: Webhook route needs raw body for HMAC verification
app.use('/api/webhook', express.raw({ type: 'application/json' }));

// All other routes use JSON
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/webhook', webhookRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/incidents', incidentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'honeyvault', timestamp: new Date().toISOString() });
});

// Test attack trigger (dev/demo only)
if (process.env.NODE_ENV !== 'production') {
  const { triggerTestAttack } = require('./scripts/demoAttack');
  app.post('/api/test/trigger-attack', async (req, res) => {
    try {
      const result = await triggerTestAttack(req.body);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await initDb();
    console.log('[DB] Database connected and initialized');

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[SERVER] HoneyVault backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[FATAL] Failed to start:', err);
    process.exit(1);
  }
}

start();

module.exports = { app, server };
