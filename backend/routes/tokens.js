const express = require('express');
const router = express.Router();
const { query } = require('../db/client');

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
 * Plant a new honeytoken
 */
router.post('/honeytokens', async (req, res) => {
  try {
    const { disguiseAs, serviceProvider } = req.body;
    if (!disguiseAs || !serviceProvider) {
      return res.status(400).json({ error: 'disguiseAs and serviceProvider are required' });
    }
    const fakeClientId = `honey_${serviceProvider}_${Math.random().toString(36).slice(2, 10)}`;
    const { rows } = await query(
        `INSERT INTO honeytokens (client_id, label, disguise_as, vault_token_id, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
        [fakeClientId, `${disguiseAs}`, disguiseAs, null]
    );
    res.json({ honeytoken: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/tokens/honeytokens/:id
 * Deactivate a honeytoken
 */
router.delete('/honeytokens/:id', async (req, res) => {
  try {
    await query(`UPDATE honeytokens SET is_active = false WHERE id = $1`, [req.params.id]);
    res.json({ deactivated: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tokens/real
 * List real tokens
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
 * Register a real token
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
 */
router.get('/vault-status', async (req, res) => {
  try {
    const { getManagementToken } = require('../services/tokenVault');
    const axios = require('axios');
    const token = await getManagementToken();
    const userEmail = req.query.email;

    const response = await axios.get(
        `https://${process.env.AUTH0_DOMAIN}/api/v2/users`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            q: `identities.connection:"google-oauth2"`,
            search_engine: 'v3',
            fields: 'user_id,email,identities,app_metadata,blocked',
            include_fields: 'true',
          },
        }
    );

    const users = response.data;
    const filteredUsers = userEmail
        ? users.filter(u => u.email === userEmail)
        : users;

    const status = filteredUsers.map(user => {
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

/**
 * POST /api/tokens/seed
 * Seed honeytokens directly via API
 */
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

/**
 * POST /api/tokens/unblock/:userId
 * Unblock a user after investigation
 */
router.post('/unblock/:userId', async (req, res) => {
  try {
    const { getManagementToken } = require('../services/tokenVault');
    const axios = require('axios');
    const token = await getManagementToken();

    await axios.patch(
        `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(req.params.userId)}`,
        {
          blocked: false,
          app_metadata: {
            credential_compromised: false,
            google_rotated_at: null,
          },
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    res.json({ unblocked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;