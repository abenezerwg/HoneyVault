router.get('/vault-status', async (req, res) => {
  try {
    const { getManagementToken } = require('../services/tokenVault');
    const axios = require('axios');
    const token = await getManagementToken();

    // Get the user email from the Auth0 session header if available
    const userEmail = req.query.email;

    // Fetch all users with Google connection
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

    // If email provided, only return that user
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