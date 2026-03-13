/**
 * TokenVaultMap.js
 * Visual representation of Token Vault contents.
 * Shows real tokens mixed with honeytokens — attacker can't tell which is which.
 * When a honeytoken is triggered, it pulses red.
 */

export default function TokenVaultMap({ honeytokens = [], activeIncident }) {
  // Hard-coded real token entries (display only — no secrets shown)
  const realTokens = [
    { id: 'real-1', label: 'github-prod', service: 'github', icon: '🐙', isReal: true },
    { id: 'real-2', label: 'stripe-live', service: 'stripe', icon: '💳', isReal: true },
    { id: 'real-3', label: 'aws-production', service: 'aws', icon: '☁️', isReal: true },
  ];

  const allTokens = [
    ...realTokens,
    ...honeytokens.map(h => ({
      id: h.id,
      label: h.label,
      service: h.disguise_as,
      icon: serviceIcon(h.disguise_as),
      isReal: false,
      isTriggered: !!h.triggered_at,
      triggeredAt: h.triggered_at,
    })),
  ].sort(() => Math.random() - 0.5); // Shuffle so attacker can't tell by position

  return (
    <div style={{ padding: 16, flex: 1 }}>
      <div style={{
        fontSize: 10,
        color: 'var(--muted)',
        marginBottom: 16,
        lineHeight: 1.6,
      }}>
        Real credentials are stored alongside honeytokens.
        Attackers cannot distinguish them.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {allTokens.map(token => (
          <TokenTile key={token.id} token={token} />
        ))}
      </div>

      {honeytokens.length > 0 && (
        <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--muted)', marginBottom: 10 }}>
            LEGEND
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10 }}>
            <LegendItem color="#30d158" label="Real credential (protected)" />
            <LegendItem color="#ff6b35" label="Honeytoken (decoy trap)" />
            <LegendItem color="#ff2d55" label="Honeytoken (triggered!)" pulse />
          </div>
        </div>
      )}
    </div>
  );
}

function TokenTile({ token }) {
  const bg = token.isTriggered
    ? 'rgba(255,45,85,0.15)'
    : token.isReal
    ? 'rgba(48,209,88,0.08)'
    : 'rgba(255,107,53,0.08)';

  const border = token.isTriggered
    ? '#ff2d55'
    : token.isReal
    ? '#30d158'
    : '#ff6b35';

  return (
    <div
      title={token.isReal ? 'Real credential' : `Honeytoken${token.isTriggered ? ' — TRIGGERED' : ''}`}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        minWidth: 72,
        animation: token.isTriggered ? 'criticalPulse 1.5s infinite' : 'none',
        cursor: 'default',
      }}
    >
      <span style={{ fontSize: 18 }}>{token.icon}</span>
      <span style={{
        fontSize: 9,
        color: token.isTriggered ? '#ff2d55' : 'var(--muted)',
        textAlign: 'center',
        maxWidth: 64,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {token.label}
      </span>
      {token.isTriggered && (
        <span style={{ fontSize: 7, color: '#ff2d55', letterSpacing: '0.1em' }}>TRIGGERED</span>
      )}
    </div>
  );
}

function LegendItem({ color, label, pulse }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 10, height: 10,
        background: color,
        opacity: 0.7,
        animation: pulse ? 'criticalPulse 1.5s infinite' : 'none',
      }} />
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <style>{`
        @keyframes criticalPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px ${color}; }
          50% { opacity: 0.4; box-shadow: 0 0 0px ${color}; }
        }
      `}</style>
    </div>
  );
}

function serviceIcon(service = '') {
  const icons = { github: '🐙', stripe: '💳', aws: '☁️', twilio: '📱', sendgrid: '✉️' };
  return icons[service.toLowerCase().split('-')[0]] || '🔑';
}
