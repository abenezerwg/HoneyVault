const axios = require('axios');

let _managementToken = null;
let _tokenExpiry = 0;

async function getManagementToken() {
  // if (_managementToken && Date.now() < _tokenExpiry - 10000) {
  //   return _managementToken;
  // }
    if (false) {
        return _managementToken;
    }

  const response = await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
      {
        grant_type: 'client_credentials',
        client_id: process.env.AUTH0_M2M_CLIENT_ID,
        client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
        audience: process.env.AUTH0_AUDIENCE,
      }
  );
  _managementToken = response.data.access_token;
  _tokenExpiry = Date.now() + response.data.expires_in * 1000;
  console.log('[TokenVault] Management token refreshed');
  return _managementToken;
}

/**
 * Exchange a user's Auth0 access token for their Google token from Token Vault
 * This is the correct Token Vault API — RFC 8693 Token Exchange
 */
async function getTokenFromVault(userAccessToken, connection = 'google-oauth2') {
  const response = await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
      {
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        subject_token: userAccessToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        requested_token_type: 'urn:auth0:params:oauth:token-type:federated-connection-access-token',
        connection,
      }
  );
  console.log(`[TokenVault] Retrieved ${connection} token from Token Vault`);
  return response.data.access_token;
}

/**
 * Get all users who have connected their Google account
 */
async function getUsersWithConnectedAccounts(connection = 'google-oauth2') {
    const token = await getManagementToken();
    const response = await axios.get(
        `https://${process.env.AUTH0_DOMAIN}/api/v2/users`,
        {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                q: `identities.connection:"${connection}"`,
                search_engine: 'v3',
                fields: 'user_id,email,identities,app_metadata,blocked',
                include_fields: 'true',
            },
        }
    );
    return response.data;
}

/**
 * Rotate (invalidate) a user's Token Vault credential by unlinking their
 * connected account. This makes any stolen token immediately useless.
 */
async function rotateVaultToken(userId, connection, providerId) {
    const token = await getManagementToken();

    console.log(`[TokenVault] Rotating credentials for user ${userId}`);

    try {
        // For primary identities we can't unlink, so we:
        // 1. Record the rotation in app_metadata
        // 2. Block the user temporarily to invalidate their session
        // 3. Revoke all sessions/tokens

        // Step 1 — Mark as rotated in app_metadata
        await axios.patch(
            `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
            {
                app_metadata: {
                    [`${connection}_rotated_at`]: new Date().toISOString(),
                    [`${connection}_rotation_reason`]: 'honeytoken_triggered',
                    credential_compromised: true,
                },
                blocked: true, // Block user to force re-authentication
            },
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );

        // Step 2 — Revoke all refresh tokens and sessions
        await axios.delete(
            `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}/sessions`,
            { headers: { Authorization: `Bearer ${token}` } }
        ).catch(() => {}); // Ignore if sessions endpoint not available

        console.log(`[TokenVault] ✅ Credentials rotated for user ${userId} — account blocked, sessions revoked`);
        return { rotated: true, userId, connection };
    } catch (err) {
        console.error(`[TokenVault] ❌ Rotation failed: ${err.response?.status} — ${JSON.stringify(err.response?.data)}`);
        throw err;
    }
}

/**
 * List connected identities for a user (their Token Vault entries)
 */
async function getUserIdentities(userId) {
  const token = await getManagementToken();
  const response = await axios.get(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data.identities || [];
}

module.exports = {
  getManagementToken,
  getTokenFromVault,
  getUsersWithConnectedAccounts,
  rotateVaultToken,
  getUserIdentities,
};