/**
 * demoAttack.js
 * Simulate an attacker using a stolen honeytoken — for demo purposes.
 * Triggers the full HoneyVault response pipeline.
 *
 * Usage: npm run demo:attack
 * Or via API: POST /api/test/trigger-attack
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');
const { initDb, query } = require('../db/client');

const FAKE_ATTACKER_IPS = ['185.220.101.7', '91.108.56.14', '198.96.155.3', '45.142.212.100'];
const FAKE_USER_AGENTS = [
  'python-requests/2.28.0',
  'curl/7.88.1',
  'Go-http-client/2.0',
  'Mozilla/5.0 (compatible; MJ12bot/v1.4.8)',
];

async function triggerTestAttack({ honeytokenId } = {}) {
  await initDb();

  // Get a honeytoken to "use"
  let honeytoken;
  if (honeytokenId) {
    const { rows } = await query(`SELECT * FROM honeytokens WHERE id = $1`, [honeytokenId]);
    honeytoken = rows[0];
  } else {
    const { rows } = await query(`SELECT * FROM honeytokens WHERE is_active = true LIMIT 1`);
    honeytoken = rows[0];
  }

  if (!honeytoken) {
    throw new Error('No active honeytokens found. Run: npm run seed:honeytokens');
  }

  const attackerIp = FAKE_ATTACKER_IPS[Math.floor(Math.random() * FAKE_ATTACKER_IPS.length)];
  const userAgent = FAKE_USER_AGENTS[Math.floor(Math.random() * FAKE_USER_AGENTS.length)];

  const payload = {
    honeytoken_client_id: honeytoken.client_id,
    attacker_ip: attackerIp,
    user_agent: userAgent,
    headers: {
      'X-Forwarded-For': attackerIp,
      'Accept': 'application/json',
      'Authorization': `Bearer ${honeytoken.client_id}:fake_usage_attempt`,
    },
    event_type: 'token_usage_detected',
    service: honeytoken.disguise_as,
    timestamp: new Date().toISOString(),
  };

  const PORT = process.env.PORT || 3001;
  const response = await axios.post(
    `http://localhost:${PORT}/api/webhook/honeytoken`,
    payload,
    { headers: { 'Content-Type': 'application/json' } }
  );

  console.log('🚨 Attack triggered!', {
    honeytoken: honeytoken.label,
    attackerIp,
    incidentId: response.data.incident_id,
  });

  return response.data;
}

// If run directly
if (require.main === module) {
  triggerTestAttack()
    .then(result => {
      console.log('Result:', result);
      setTimeout(() => process.exit(0), 1000);
    })
    .catch(err => {
      console.error('Demo failed:', err.message);
      process.exit(1);
    });
}

module.exports = { triggerTestAttack };
