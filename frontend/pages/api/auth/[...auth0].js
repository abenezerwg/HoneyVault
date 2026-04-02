import { handleAuth, handleLogin, handleCallback } from '@auth0/nextjs-auth0';

export default handleAuth({
    login: handleLogin({
        returnTo: '/',
    }),
    callback: handleCallback({
        afterCallback: (req, res, session, state) => {
            return session;
        },
        onError: (req, res, error) => {
            if (error.message.includes('user is blocked') ||
                error.message.includes('blocked')) {
                res.redirect('/blocked');
                return;
            }
            res.redirect('/error');
        }
    }),
});