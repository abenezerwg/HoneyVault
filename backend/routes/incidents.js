/**
 * incidents.js
 * API routes for incident management
 */

const express = require('express');
const router = express.Router();
const { query } = require('../db/client');

/**
 * GET /api/incidents
 * List all incidents with pagination
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;

    const whereClause = status ? `WHERE i.status = '${status}'` : '';

    const { rows } = await query(`
      SELECT 
        i.*,
        h.client_id as honey_client_id,
        h.label as honey_label,
        h.disguise_as,
        (SELECT COUNT(*) FROM agent_logs al WHERE al.incident_id = i.id) as agent_steps
      FROM incidents i
      JOIN honeytokens h ON i.honeytoken_id = h.id
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const { rows: countRows } = await query(`SELECT COUNT(*) FROM incidents ${whereClause}`);

    res.json({
      incidents: rows,
      pagination: {
        page,
        limit,
        total: parseInt(countRows[0].count),
        pages: Math.ceil(countRows[0].count / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/incidents/:id
 * Get full incident details including AI analysis and agent logs
 */
router.get('/:id', async (req, res) => {
  try {
    const { rows: incidents } = await query(`
      SELECT 
        i.*,
        h.client_id as honey_client_id,
        h.label as honey_label,
        h.disguise_as,
        h.created_at as honey_created_at
      FROM incidents i
      JOIN honeytokens h ON i.honeytoken_id = h.id
      WHERE i.id = $1
    `, [req.params.id]);

    if (incidents.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const { rows: agentLogs } = await query(`
      SELECT * FROM agent_logs 
      WHERE incident_id = $1 
      ORDER BY step ASC
    `, [req.params.id]);

    res.json({ incident: incidents[0], agentLogs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/incidents/:id
 * Update incident status
 */
router.patch('/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const { rows } = await query(
      `UPDATE incidents SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
