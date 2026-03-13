import { useEffect, useRef } from 'react';

const EVENT_STYLES = {
  agent_started:  { icon: '🤖', color: '#7c5cbf', label: 'AGENT STARTED' },
  agent_thinking: { icon: '💭', color: '#7c5cbf', label: 'REASONING' },
  agent_tool_call:{ icon: '🔧', color: '#ffd60a', label: 'TOOL CALL' },
  rotation:       { icon: '🔄', color: '#30d158', label: 'ROTATION' },
  rotation_complete: { icon: '✅', color: '#30d158', label: 'ROTATED' },
  complete:       { icon: '✅', color: '#30d158', label: 'COMPLETE' },
  agent_complete: { icon: '✅', color: '#30d158', label: 'COMPLETE' },
  agent_error:    { icon: '❌', color: '#ff2d55', label: 'ERROR' },
};

const TOOL_DESCRIPTIONS = {
  get_incident_context:   'Fetching incident context...',
  assess_threat_severity: 'Assessing threat severity...',
  rotate_credentials:     'Rotating credentials in Token Vault...',
  generate_incident_report: 'Generating incident report...',
  update_incident_status: 'Updating incident status...',
};

export default function AgentLogPanel({ events, incidentId }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  if (!incidentId && events.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, lineHeight: 1.8 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
          <div>AI Agent is standing by.</div>
          <div style={{ fontSize: 10, marginTop: 8, opacity: 0.6 }}>
            Simulate an attack to see<br />the agent in action.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
      {events.map((event) => {
        const style = EVENT_STYLES[event.type] || { icon: '○', color: 'var(--muted)', label: event.type };

        return (
          <div
            key={event.id}
            style={{
              marginBottom: 8,
              padding: '8px 10px',
              borderLeft: `2px solid ${style.color}`,
              background: `${style.color}10`,
              animation: 'fadeIn 0.3s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span>{style.icon}</span>
              <span style={{ fontSize: 9, letterSpacing: '0.15em', color: style.color, fontWeight: 700 }}>
                {style.label}
              </span>
            </div>

            {event.tool && (
              <div style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'Space Mono, monospace' }}>
                {TOOL_DESCRIPTIONS[event.tool] || event.tool}
              </div>
            )}

            {event.text && (
              <div style={{
                fontSize: 10,
                color: 'var(--muted)',
                lineHeight: 1.6,
                maxHeight: 80,
                overflow: 'hidden',
                maskImage: 'linear-gradient(to bottom, black 60%, transparent)',
              }}>
                {event.text.slice(0, 200)}
              </div>
            )}

            {event.message && (
              <div style={{ fontSize: 11, color: 'var(--text)' }}>
                {event.message}
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
