import Head from 'next/head';

export default function LoginPage() {
  return (
      <>
        <Head>
          <title>HoneyVault — Login</title>
          <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700;900&display=swap" rel="stylesheet" />
        </Head>
        <div style={{ background: '#020805', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Share Tech Mono, monospace' }}>
          <div style={{ textAlign: 'center', padding: '48px 56px', border: '1px solid rgba(0,255,65,0.15)', background: 'rgba(0,255,65,0.02)', maxWidth: 440, width: '100%' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🍯</div>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 24, fontWeight: 900, color: '#00ff41', letterSpacing: '0.2em', marginBottom: 8 }}>
              HONEYVAULT
            </div>
            <div style={{ fontSize: 10, color: '#2d6638', letterSpacing: '0.15em', marginBottom: 48 }}>
              AI-Powered Deception Defense
            </div>
            <div style={{ background: 'rgba(0,255,65,0.05)', border: '1px solid rgba(0,255,65,0.15)', padding: '16px 20px', marginBottom: 32, textAlign: 'left' }}>
              <div style={{ fontSize: 9, color: '#00ff41', letterSpacing: '0.2em', marginBottom: 10 }}>SECURE ACCESS</div>
              <div style={{ fontSize: 11, color: '#2d6638', lineHeight: 1.8 }}>
                ✓ Connect via Google OAuth<br />
                ✓ Credentials stored in Auth0 Token Vault<br />
                ✓ Protected by AI threat detection
              </div>
            </div>
            <a href="/api/auth/login?connection=google-oauth2" style={{ display: 'block', background: 'transparent', border: '1px solid #00ff41', color: '#00ff41', padding: '14px 32px', textDecoration: 'none', fontSize: 12, letterSpacing: '0.15em', marginBottom: 16 }}>
              🔐 Connect with Google
            </a>
            <div style={{ fontSize: 10, color: '#2d6638', lineHeight: 1.6 }}>
              Auth0 Token Vault Hackathon 2026
            </div>
          </div>
        </div>
      </>
  );
}