import { formatDistanceToNow } from 'date-fns';

const SEVERITY_COLORS = {
  critical: '#ff2d55',
  high: '#ff6b35',
  medium: '#ffd60a',
  low: '#30d158',
};

const STATUS_LABELS = {
  open: { label: 'OPEN', color: '#ff2d55' },
  investigating: { label: 'ANALYZING', color: '#ffd60a' },
  resolved: { label: 'RESOLVED', color: '#30d158' },
};

export default function IncidentCard({ incident, active, onClick }) {
  const severity = SEVERITY_COLORS[incident.severity] || '#ff6b35';
  const status = STATUS_LABELS[incident.status] || STATUS_LABELS.open;

  return (
    <div
      onClick={onClick}
      style={{
        borderLeft: `3px solid ${severity}`,
        background: active ? 'rgba(255,107,53,0.08)' : 'transparent',
        padding: '12px 14px',
        marginBottom: 4,
        cursor: 'pointer',
        transition: 'background 0.2s',
        borderBottom: '1px solid var(--border)',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: severity, fontWeight: 700, letterSpacing: '0.1em' }}>
          {incident.severity?.toUpperCase()} SEVERITY
        </span>
        <span style={{ fontSize: 9, color: status.color, letterSpacing: '0.08em' }}>
          ● {status.label}
        </span>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4 }}>
        🍯 {incident.honey_label || 'Unknown honeytoken'}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)' }}>
        <span>IP: {incident.attacker_ip || 'unknown'}</span>
        <span>{formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}</span>
      </div>

      {incident.ai_analysis && (
        <div style={{
          marginTop: 8,
          padding: '6px 8px',
          background: 'rgba(124,92,191,0.1)',
          borderLeft: '2px solid var(--ai)',
          fontSize: 10,
          color: 'var(--muted)',
          fontStyle: 'italic',
        }}>
          {incident.ai_analysis.attack_summary?.slice(0, 80)}...
        </div>
      )}
    </div>
  );
}
