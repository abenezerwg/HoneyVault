/**
 * seedHoneytokens.js
 * One-time script to plant honeytokens in Token Vault alongside real credentials.
 * Run this once after setting up your real tokens.
 *
 * Usage: npm run seed:honeytokens
 */

require('dotenv').config({ path: '../.env' });
const { initDb, query } = require('../db/client');
const { createHoneytoken, createVaultToken } = require('../services/tokenVault');

const HONEYTOKENS_TO_PLANT = [
  { disguiseAs: 'github-prod', serviceProvider: 'github' },
  { disguiseAs: 'stripe-live', serviceProvider: 'stripe' },
  { disguiseAs: 'aws-production', serviceProvider: 'aws' },
];

const REAL_TOKENS_TO_REGISTER = [
  { label: 'github-prod', service: 'github', vaultTokenId: process.env.REAL_GITHUB_VAULT_ID || 'placeholder_github' },
  { label: 'stripe-live', service: 'stripe', vaultTokenId: process.env.REAL_STRIPE_VAULT_ID || 'placeholder_stripe' },
  { label: 'aws-production', service: 'aws', vaultTokenId: process.env.REAL_AWS_VAULT_ID || 'placeholder_aws' },
];

async function seed() {
  await initDb();
  console.log('🍯 HoneyVault — Seeding honeytokens...\n');

  // Register real tokens first
  console.log('📦 Registering real tokens...');
  for (const rt of REAL_TOKENS_TO_REGISTER) {
    const { rows } = await query(
      `INSERT INTO real_tokens (label, vault_token_id, service) 
       VALUES ($1, $2, $3) 
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [rt.label, rt.vaultTokenId, rt.service]
    );
    if (rows.length > 0) {
      console.log(`  ✅ Registered real token: ${rt.label} (${rt.service})`);
    } else {
      console.log(`  ⚠️  Token already exists: ${rt.label}`);
    }
  }

  console.log('\n🎭 Planting honeytokens...');
  for (const config of HONEYTOKENS_TO_PLANT) {
    try {
      // Skip if already planted
      const { rows: existing } = await query(
        `SELECT id FROM honeytokens WHERE disguise_as = $1 AND is_active = true`,
        [config.disguiseAs]
      );

      if (existing.length > 0) {
        console.log(`  ⚠️  Honeytoken already planted for: ${config.disguiseAs}`);
        continue;
      }

      // Create in Token Vault (fake but realistic credentials)
      const { vaultToken, fakeClientId, fakeSecret } = await createHoneytoken(config);

      // Save to DB
      await query(
        `INSERT INTO honeytokens (client_id, label, disguise_as, vault_token_id, is_active)
         VALUES ($1, $2, $3, $4, true)`,
        [fakeClientId, `${config.disguiseAs}`, config.disguiseAs, vaultToken?.id || null]
      );

      console.log(`  ✅ Planted honeytoken for: ${config.disguiseAs}`);
      console.log(`     client_id: ${fakeClientId}`);
      console.log(`     vault_id:  ${vaultToken?.id || 'N/A (Token Vault not configured)'}`);
    } catch (err) {
      console.error(`  ❌ Failed to plant honeytoken for ${config.disguiseAs}:`, err.message);
    }
  }

  console.log('\n📊 Final state:');
  const { rows: summary } = await query(`
    SELECT 
      (SELECT COUNT(*) FROM honeytokens WHERE is_active = true) as active_honeytokens,
      (SELECT COUNT(*) FROM real_tokens WHERE is_active = true) as real_tokens
  `);
  console.log(`  Active honeytokens: ${summary[0].active_honeytokens}`);
  console.log(`  Real tokens registered: ${summary[0].real_tokens}`);
  console.log('\n✨ Seeding complete! Your trap is set.\n');

  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
