export default function TokenVaultMap({ honeytokens = [], activeIncident, vaultUsers = [] }) {

    // Real tokens come from Auth0 Token Vault (actual connected accounts)
    const realTokens = vaultUsers.map(user => ({
        id: `real-${user.userId}`,
        label: user.email,
        service: 'google',
        icon: '🔑',
        isReal: true,
        isBlocked: user.isBlocked,
        tokenPresent: user.tokenPresent,
    }));

    // Honeytokens are fake decoys from our DB
    const fakeTokens = honeytokens.map(h => ({
        id: h.id,
        label: h.label,
        service: h.disguise_as,
        icon: serviceIcon(h.disguise_as),
        isReal: false,
        isTriggered: !!h.triggered_at,
    }));

    // Mix them together — attacker can't tell which is which
    const allTokens = shuffle([...realTokens, ...fakeTokens]);

    return (
        <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>

            {/* Header explanation */}
            <div style={{
                fontSize: 10,
                color: 'var(--muted)',
                marginBottom: 16,
                lineHeight: 1.8,
                borderLeft: '2px solid var(--border)',
                paddingLeft: 10,
            }}>
                Real credentials from Auth0 Token Vault are mixed with honeytokens.
                An attacker cannot distinguish them.
            </div>

            {/* Token grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {allTokens.map(token => (
                    <TokenTile key={token.id} token={token} />
                ))}
            </div>

            {/* Stats bar */}
            <div style={{
                display: 'flex',
                gap: 16,
                padding: '8px 12px',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border)',
                fontSize: 10,
                marginBottom: 16,
            }}>
        <span style={{ color: 'var(--success)' }}>
          🔑 {realTokens.length} real credential{realTokens.length !== 1 ? 's' : ''}
        </span>
                <span style={{ color: 'var(--warning)' }}>
          🍯 {fakeTokens.length} honeytoken{fakeTokens.length !== 1 ? 's' : ''}
        </span>
                <span style={{ color: 'var(--muted)' }}>
          👁 {allTokens.length} total visible to attacker
        </span>
            </div>

            {/* Legend */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--muted)', marginBottom: 8 }}>
                    LEGEND
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 10 }}>
                    <LegendItem color="var(--success)" label="Real credential — stored in Auth0 Token Vault" />
                    <LegendItem color="var(--warning)" label="Honeytoken — decoy trap (stored in DB)" />
                    <LegendItem color="var(--critical)" label="Honeytoken triggered — attacker detected!" pulse />
                    <LegendItem color="var(--muted)" label="Real credential blocked — rotation complete" />
                </div>
            </div>
        </div>
    );
}

function TokenTile({ token }) {
    let border, bg, label;

    if (token.isTriggered) {
        border = 'var(--critical)';
        bg = 'rgba(255,36,0,0.12)';
        label = 'TRIGGERED';
    } else if (token.isReal && token.isBlocked) {
        border = 'var(--muted)';
        bg = 'rgba(0,0,0,0.3)';
        label = 'BLOCKED';
    } else if (token.isReal) {
        border = 'var(--success)';
        bg = 'rgba(0,255,65,0.06)';
        label = 'REAL';
    } else {
        border = 'var(--warning)';
        bg = 'rgba(255,170,0,0.06)';
        label = 'DECOY';
    }

    return (
        <div
            title={token.isReal
                ? `Real Token Vault credential: ${token.label}`
                : `Honeytoken (fake): ${token.label}`}
            style={{
                background: bg,
                border: `1px solid ${border}`,
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                minWidth: 68,
                animation: token.isTriggered ? 'criticalPulse 1.5s infinite' : 'none',
                position: 'relative',
            }}
        >
            <span style={{ fontSize: 18 }}>{token.icon}</span>
            <span style={{
                fontSize: 8,
                color: border,
                textAlign: 'center',
                maxWidth: 64,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
            }}>
        {token.label}
      </span>
            <span style={{
                fontSize: 7,
                letterSpacing: '0.1em',
                color: border,
                opacity: 0.8,
            }}>
        {label}
      </span>
            <style>{`
        @keyframes criticalPulse {
          0%, 100% { box-shadow: 0 0 8px var(--critical); }
          50% { box-shadow: none; }
        }
      `}</style>
        </div>
    );
}

function LegendItem({ color, label, pulse }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
                width: 10, height: 10,
                background: color,
                opacity: 0.8,
                flexShrink: 0,
                animation: pulse ? 'criticalPulse 1.5s infinite' : 'none',
            }} />
            <span style={{ color: 'var(--muted)' }}>{label}</span>
        </div>
    );
}

function serviceIcon(service = '') {
    const icons = {
        github: '🐙',
        stripe: '💳',
        aws: '☁️',
        google: '🔑',
        twilio: '📱',
        sendgrid: '✉️',
    };
    return icons[service?.toLowerCase().split('-')[0]] || '🔑';
}

// Stable shuffle using a seed so no hydration mismatch
function shuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor((i * 9301 + 49297) % 233280 / 233280 * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}