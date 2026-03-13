/**
 * tokenVault.js
 * Wrapper for Auth0 Token Vault API + Management API
 *
 * Token Vault stores third-party OAuth credentials (e.g. GitHub tokens,
 * Stripe keys) securely in Auth0. We use it to store BOTH real and fake
 * (honeytoken) credentials, making them indistinguishable to an attacker.
 *
 * Docs: https://auth0.com/docs/secure/tokens/token-vault
 */

const axios = require('axios');

let _managementToken = null;
let _tokenExpiry = 0;

/**
 * Get a Management API access token (cached, auto-refreshed)
 */
async function getManagementToken() {
  if (_managementToken && Date.now() < _tokenExpiry - 10000) {
    return _managementToken;
  }

  const response = await axios.post(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    grant_type: 'client_credentials',
    client_id: process.env.AUTH0_M2M_CLIENT_ID,
    client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
    audience: process.env.AUTH0_AUDIENCE,
  });

  _managementToken = response.data.access_token;
  _tokenExpiry = Date.now() + (response.data.expires_in * 1000);
  console.log('[TokenVault] Management token refreshed');
  return _managementToken;
}

/**
 * List all tokens in Token Vault
 */
async function listVaultTokens() {
  const token = await getManagementToken();
  const response = await axios.get(
    `https://${process.env.AUTH0_DOMAIN}/api/v2/token-vault/tokens`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

/**
 * Create a new token in Token Vault
 * @param {Object} params
 * @param {string} params.label - Human-readable name
 * @param {string} params.serviceProvider - e.g. "github", "stripe"
 * @param {Object} params.credentials - { client_id, client_secret, access_token, etc. }
 * @param {Object} params.metadata - Additional metadata to store
 */
async function createVaultToken({ label, serviceProvider, credentials, metadata = {} }) {
  const token = await getManagementToken();

  const response = await axios.post(
    `https://${process.env.AUTH0_DOMAIN}/api/v2/token-vault/tokens`,
    {
      label,
      service_provider: serviceProvider,
      credentials,
      metadata,
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );

  return response.data;
}

/**
 * Delete a token from Token Vault (used after rotation to remove old credentials)
 */
async function deleteVaultToken(tokenId) {
  const token = await getManagementToken();

  await axios.delete(
    `https://${process.env.AUTH0_DOMAIN}/api/v2/token-vault/tokens/${tokenId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  console.log(`[TokenVault] Deleted token: ${tokenId}`);
  return true;
}

/**
 * Update/rotate a token's credentials in Token Vault
 * This is called after an attack is detected to swap in new credentials
 */
async function rotateVaultToken(tokenId, newCredentials) {
  const token = await getManagementToken();

  const response = await axios.patch(
    `https://${process.env.AUTH0_DOMAIN}/api/v2/token-vault/tokens/${tokenId}`,
    { credentials: newCredentials },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );

  console.log(`[TokenVault] Rotated token: ${tokenId}`);
  return response.data;
}

/**
 * Create a honeytoken — a fake but realistic-looking credential
 * Stored in Token Vault exactly like a real token; tagged in our DB as fake
 */
async function createHoneytoken({ disguiseAs, serviceProvider }) {
  const fakeClientId = `honey_${serviceProvider}_${Math.random().toString(36).slice(2, 10)}`;
  const fakeSecret = `sk_live_${generateFakeSecret(32)}`;

  const vaultToken = await createVaultToken({
    label: `${disguiseAs}`,  // Deliberately same label as real token
    serviceProvider,
    credentials: {
      client_id: fakeClientId,
      client_secret: fakeSecret,
      token_type: 'oauth2',
    },
    metadata: {
      _is_honeytoken: true,  // Hidden metadata
      _honey_id: fakeClientId,
    },
  });

  return { vaultToken, fakeClientId, fakeSecret };
}

/**
 * Generate a realistic-looking fake secret string
 */
function generateFakeSecret(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

module.exports = {
  getManagementToken,
  listVaultTokens,
  createVaultToken,
  deleteVaultToken,
  rotateVaultToken,
  createHoneytoken,
};
