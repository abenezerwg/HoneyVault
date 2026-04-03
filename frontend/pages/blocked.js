import Head from 'next/head';

export default function BlockedPage() {
  return (
    <>
      <Head>
        <title>Account Locked — HoneyVault</title>
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700;900&display=swap" rel="stylesheet" />
      </Head>

      <div style={{
        background: '#020805',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Share Tech Mono, monospace',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,65,0.018) 3px, rgba(0,255,65,0.018) 4px)',
      }}>
        <div style={{
          textAlign: 'center',
          padding: 48,
          border: '1px solid rgba(255,36,0,0.3)',
          background: 'rgba(255,36,0,0.05)',
          maxWidth: 560,
        }}>
          {/* Pulsing alert icon */}
          <div style={{
            fontSize: 64,
            marginBottom: 24,
            animation: 'pulse 1.5s infinite',
          }}>
            🔒
          </div>

          {/* Title */}
          <div style={{
            fontFamily: 'Orbitron, monospace',
            fontSize: 22,
            fontWeight: 900,
            color: '#ff2400',
            letterSpacing: '0.15em',
            marginBottom: 16,
            textShadow: '0 0 20px rgba(255,36,0,0.5)',
          }}>
            ACCOUNT LOCKED
          </div>

          {/* Warning badge */}
          <div style={{
            display: 'inline-block',
            background: 'rgba(255,36,0,0.1)',
            border: '1px solid rgba(255,36,0,0.4)',
            color: '#ff2400',
            fontSize: 10,
            letterSpacing: '0.2em',
            padding: '4px 16px',
            marginBottom: 28,
          }}>
            ⚠ SECURITY INCIDENT DETECTED
          </div>

          {/* Main message */}
          <div style={{
            color: '#9effa8',
            fontSize: 13,
            lineHeight: 1.9,
            marginBottom: 28,
          }}>
            Your account has been <strong style={{ color: '#ff2400' }}>automatically locked</strong> by
            HoneyVault's AI security agent.
            <br /><br />
            A honeytoken associated with your credentials was used by an
            unauthorized party, indicating your OAuth tokens may have been
            compromised.
            <br /><br />
            All active sessions have been <strong style={{ color: '#ff2400' }}>revoked</strong> and
            your Token Vault credentials have been <strong style={{ color: '#ff2400' }}>rotated</strong>.
          </div>

          {/* Info box */}
          <div style={{
            background: 'rgba(0,255,65,0.05)',
            border: '1px solid rgba(0,255,65,0.2)',
            padding: '16px 20px',
            marginBottom: 28,
            textAlign: 'left',
          }}>
            <div style={{ fontSize: 10, color: '#00ff41', letterSpacing: '0.15em', marginBottom: 12 }}>
              WHAT HAPPENED
            </div>
            <div style={{ fontSize: 11, color: '#6b8a6b', lineHeight: 1.8 }}>
              ✓ Honeytoken trigger detected<br />
              ✓ Claude AI agent notified<br />
              ✓ Real credentials rotated via Auth0 Token Vault<br />
              ✓ All sessions revoked<br />
              ✓ Incident report filed
            </div>
          </div>

          {/* What to do */}
          <div style={{
            fontSize: 11,
            color: '#2d6638',
            lineHeight: 1.8,
            marginBottom: 32,
          }}>
            To regain access, contact your security administrator
            to review the incident report and unblock your account
            after investigation is complete.
          </div>

          {/* Back button */}

          <a href="/"
          style={{
          display: 'inline-block',
          background: 'transparent',
          border: '1px solid #00ff41',
          color: '#00ff41',
          padding: '10px 32px',
          textDecoration: 'none',
          fontSize: 11,
          letterSpacing: '0.12em',
          transition: 'all 0.2s',
        }}
          >
          &#8592; RETURN TO DASHBOARD
        </a>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.1); }
          }
        `}</style>
      </div>
    </>
  );
}
