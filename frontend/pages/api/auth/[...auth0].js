import { handleAuth, handleLogin, handleCallback, handleLogout } from '@auth0/nextjs-auth0';

export default handleAuth({
    login: handleLogin({
        returnTo: '/',
    }),

    callback: async (req, res) => {
        try {
            await handleCallback(req, res, {
                afterCallback: (req, res, session) => {
                    return session;
                },
            });
        } catch (error) {
            console.error('[Auth] Callback error:', error.message);
            if (
                error.message?.includes('blocked') ||
                error.message?.includes('unauthorized') ||
                error.cause?.error === 'unauthorized'
            ) {
                res.redirect('/blocked');
                return;
            }
            res.redirect('/error?message=' + encodeURIComponent(error.message));
        }
    },

    logout: handleLogout({
        returnTo: '/',
    }),
});