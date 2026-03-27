/**
 * webhook.js
 * Receives POST requests when a honeytoken is used.
 *
 * This endpoint can be triggered by:
 *  1. Auth0 Log Streams (real-time auth events)
 *  2. A custom middleware in your app that detects honeytoken usage
 *  3. A monitoring service that watches Auth0 logs
 *
 * In production: set up an Auth0 Log Stream → Webhook pointing here.
 * In dev/demo: call POST /api/test/trigger-attack directly.
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { query } = require('../db/client');
const { runAttackAnalysis } = require('../services/aiAgent');
const { broadcast } = require('../services/notifier');

/**
 * Verify the webhook signature from Auth0 Log Streams
 * Prevents spoofed webhook calls
 */
function verifySignature(rawBody, signature) {
  if (!process.env.WEBHOOK_SECRET) return true; // Skip in dev if not set

  const expected = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const received = signature?.replace('sha256=', '') || '';
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(received.padEnd(expected.length, '0'), 'hex')
  );
}

/**
 * POST /api/webhook/honeytoken
 * Main honeytoken trigger endpoint
 */
router.post('/honeytoken', async (req, res) => {
  try {
    const rawBody = req.body; // express.raw() gives us Buffer
    const signature = req.headers['x-hub-signature-256'] || req.headers['x-signature'];

    // Verify signature
    if (process.env.NODE_ENV !== 'development' && !verifySignature(rawBody, signature)) {
      console.warn('[Webhook] Invalid signature — rejecting');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBody.toString());
    console.log('[Webhook] Received honeytoken event:', JSON.stringify(payload).slice(0, 200));

    const { honeytoken_client_id, attacker_ip, user_agent, headers: attackHeaders } = payload;

    if (!honeytoken_client_id) {
      return res.status(400).json({ error: 'Missing honeytoken_client_id' });
    }

    // Look up the honeytoken
    const { rows: honeytokens } = await query(
      `SELECT * FROM honeytokens WHERE client_id = $1 AND is_active = true`,
      [honeytoken_client_id]
    );

    if (honeytokens.length === 0) {
      console.warn(`[Webhook] Unknown honeytoken: ${honeytoken_client_id}`);
      // Still return 200 — don't leak info to the attacker
      return res.status(200).json({ received: true });
    }

    const honeytoken = honeytokens[0];

    // Mark honeytoken as triggered
    await query(
      `UPDATE honeytokens SET triggered_at = NOW() WHERE id = $1`,
      [honeytoken.id]
    );

    // Create incident record
    const { rows: incidents } = await query(
      `INSERT INTO incidents 
         (honeytoken_id, attacker_ip, attacker_ua, request_headers, raw_event, severity)
       VALUES ($1, $2, $3, $4, $5, 'high')
       RETURNING *`,
      [
        honeytoken.id,
        attacker_ip || req.ip,
        user_agent || req.headers['user-agent'],
        JSON.stringify(attackHeaders || {}),
        JSON.stringify(payload),
      ]
    );

    const incident = { ...incidents[0], honey_client_id: honeytoken.client_id };

    console.log(`[Webhook] Incident created: ${incident.id}`);

    // Immediately acknowledge the webhook (don't make attacker wait)
    res.status(200).json({ received: true, incident_id: incident.id });

    // Broadcast initial alert to dashboard
    broadcast({
      type: 'honeytoken_triggered',
      incidentId: incident.id,
      honeytokenLabel: honeytoken.label,
      attackerIp: incident.attacker_ip,
      timestamp: new Date().toISOString(),
    });

    // Run AI analysis in background (don't await — let webhook return fast)
    runAttackAnalysis(incident).catch(err => {
      console.error(`[Agent] Analysis failed for incident ${incident.id}:`, err);
      broadcast({
        type: 'agent_error',
        incidentId: incident.id,
        error: err.message,
      });
    });

  } catch (err) {
    console.error('[Webhook] Error processing event:', err);
    // Return 200 to prevent Auth0 retries revealing our error state
    res.status(200).json({ received: true });
  }
});

/**
 * POST /api/webhook/auth0-logstream
 * Receives raw Auth0 Log Stream events and filters for honeytoken usage
 */
router.post('/auth0-logstream', async (req, res) => {
  try {
    const rawBody = req.body;
    const payload = JSON.parse(rawBody.toString());

    // Auth0 Log Streams send arrays of events
    const events = Array.isArray(payload) ? payload : [payload];

    for (const event of events) {
      // Look for "Success Exchange" events using our honeytoken client_ids
      if (event.type === 'set' || event.type === 'seccft') { // Token exchange events
        const clientId = event.client_id || event.data?.client_id;

        if (clientId) {
          const { rows } = await query(
            `SELECT id FROM honeytokens WHERE client_id = $1 AND is_active = true`,
            [clientId]
          );

          if (rows.length > 0) {
            // Honeytoken was used in an auth event — trigger the analysis
            const honeytokenPayload = {
              honeytoken_client_id: clientId,
              attacker_ip: event.ip,
              user_agent: event.user_agent,
              headers: {},
              raw_auth0_event: event,
            };

            // Re-route to our main handler
            req.body = Buffer.from(JSON.stringify(honeytokenPayload));
            // (In production: call the handler function directly or queue it)
            console.log('[Webhook] Auth0 log stream detected honeytoken use:', clientId);
          }
        }
      }
    }

    res.status(200).json({ processed: events.length });
  } catch (err) {
    console.error('[Webhook] Log stream processing error:', err);
    res.status(200).json({ received: true });
  }
});

module.exports = router;
