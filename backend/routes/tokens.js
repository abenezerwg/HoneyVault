/**
 * tokens.js
 * API routes for managing honeytokens and real tokens
 */

const express = require('express');
const router = express.Router();
const { query } = require('../db/client');
const { createHoneytoken, listVaultTokens } = require('../services/tokenVault');

/**
 * GET /api/tokens/honeytokens
 * List all honeytokens
 */
router.get('/honeytokens', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        h.*,
        COUNT(i.id) as incident_count,
        MAX(i.created_at) as last_triggered
      FROM honeytokens h
             LEFT JOIN incidents i ON i.honeytoken_id = h.id
      GROUP BY h.id
      ORDER BY h.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tokens/honeytokens
 * Plant a new honeytoken in Token Vault
 */
router.post('/honeytokens', async (req, res) => {
  try {
    const { disguiseAs, serviceProvider } = req.body;

    if (!disguiseAs || !serviceProvider) {
      return res.status(400).json({ error: 'disguiseAs and serviceProvider are required' });
    }

    // Create in Token Vault
    const { vaultToken, fakeClientId } = await createHoneytoken({ disguiseAs, serviceProvider });

    // Save to DB
    const { rows } = await query(
        `INSERT INTO honeytokens (client_id, label, disguise_as, vault_token_id, is_active)
         VALUES ($1, $2, $3, $4, true)
           RETURNING *`,
        [fakeClientId, `${disguiseAs}-honey`, disguiseAs, vaultToken.id || null]
    );

    res.json({ honeytoken: rows[0], vaultToken });
  } catch (err) {
    console.error('[Tokens] Failed to create honeytoken:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/tokens/honeytokens/:id
 * Deactivate a honeytoken
 */
router.delete('/honeytokens/:id', async (req, res) => {
  try {
    await query(
        `UPDATE honeytokens SET is_active = false WHERE id = $1`,
        [req.params.id]
    );
    res.json({ deactivated: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tokens/real
 * List real tokens (no secrets exposed)
 */
router.get('/real', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT id, label, service, last_rotated, is_active, created_at
      FROM real_tokens
      WHERE is_active = true
      ORDER BY label
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tokens/real
 * Register a real token for protection monitoring
 */
router.post('/real', async (req, res) => {
  try {
    const { label, vaultTokenId, service } = req.body;

    const { rows } = await query(
        `INSERT INTO real_tokens (label, vault_token_id, service) VALUES ($1, $2, $3) RETURNING *`,
        [label, vaultTokenId, service]
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tokens/vault
 * List all tokens in Auth0 Token Vault (real + honeytokens)
 */
router.get('/vault', async (req, res) => {
  try {
    const tokens = await listVaultTokens();
    res.json(tokens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tokens/stats
 * Summary stats for dashboard
 */
router.get('/stats', async (req, res) => {
  try {
    const [honeytokenStats, incidentStats, recentActivity] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active,
          COUNT(*) FILTER (WHERE triggered_at IS NOT NULL) as triggered
        FROM honeytokens
      `),
      query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'open') as open,
          COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h
        FROM incidents
      `),
      query(`
        SELECT i.id, i.attacker_ip, i.severity, i.status, i.created_at, h.label as honey_label
        FROM incidents i
        JOIN honeytokens h ON i.honeytoken_id = h.id
        ORDER BY i.created_at DESC
        LIMIT 5
      `),
    ]);

    res.json({
      honeytokens: honeytokenStats.rows[0],
      incidents: incidentStats.rows[0],
      recentActivity: recentActivity.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tokens/vault-status
 * Returns real-time status of Token Vault connected accounts
 * Used by the dashboard to show before/after rotation
 */
router.get('/vault-status', async (req, res) => {
  try {
    const { getUsersWithConnectedAccounts} = require('../services/tokenVault');
    const users = await getUsersWithConnectedAccounts('google-oauth2');

    const status = users.map(user => {
      const googleIdentity = user.identities?.find(
          id => id.connection === 'google-oauth2'
      );
      const wasRotated = !!user.app_metadata?.google_rotated_at;
      const isBlocked = !!user.blocked;
      return {
        userId: user.user_id,
        email: user.email,
        googleConnected: !!googleIdentity && !isBlocked,
        tokenPresent: !!googleIdentity?.access_token && !wasRotated,
        isBlocked,
        lastRotated: user.app_metadata?.google_rotated_at || null,
      };
    });

    res.json({ users: status });
  } catch (err) {
    console.error('[Vault Status] Error:', err.message);
    res.status(500).json({ error: err.message, users: [] });
  }
});
router.post('/seed', async (req, res) => {
  try {
    const configs = [
      { disguiseAs: 'github-prod', serviceProvider: 'github' },
      { disguiseAs: 'stripe-live', serviceProvider: 'stripe' },
      { disguiseAs: 'aws-production', serviceProvider: 'aws' },
    ];

    for (const config of configs) {
      const { rows: existing } = await query(
          `SELECT id FROM honeytokens WHERE disguise_as = $1 AND is_active = true`,
          [config.disguiseAs]
      );
      if (existing.length > 0) continue;

      const fakeClientId = `honey_${config.serviceProvider}_${Math.random().toString(36).slice(2, 10)}`;
      await query(
          `INSERT INTO honeytokens (client_id, label, disguise_as, vault_token_id, is_active)
         VALUES ($1, $2, $3, $4, true)`,
          [fakeClientId, config.disguiseAs, config.disguiseAs, null]
      );
    }

    res.json({ seeded: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;