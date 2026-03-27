import { useEffect, useRef, useState } from 'react';

const EVENT_STYLES = {
  agent_started:    { icon: '🤖', color: '#7c5cbf', label: 'AGENT STARTED', bg: 'rgba(124,92,191,0.15)' },
  agent_thinking:   { icon: '💭', color: '#a78bfa', label: 'REASONING',     bg: 'rgba(167,139,250,0.1)' },
  agent_tool_call:  { icon: '🔧', color: '#ffd60a', label: 'TOOL CALL',     bg: 'rgba(255,214,10,0.1)' },
  rotation:         { icon: '🔄', color: '#30d158', label: 'ROTATING',      bg: 'rgba(48,209,88,0.1)' },
  rotation_complete:{ icon: '✅', color: '#30d158', label: 'ROTATED',       bg: 'rgba(48,209,88,0.1)' },
  complete:         { icon: '✅', color: '#30d158', label: 'COMPLETE',      bg: 'rgba(48,209,88,0.1)' },
  agent_complete:   { icon: '✅', color: '#30d158', label: 'COMPLETE',      bg: 'rgba(48,209,88,0.1)' },
  agent_error:      { icon: '❌', color: '#ff2d55', label: 'ERROR',         bg: 'rgba(255,45,85,0.1)' },
};

const TOOL_DESCRIPTIONS = {
  get_incident_context:     { label: 'Fetching incident context', detail: 'Querying database for honeytoken and attacker details' },
  assess_threat_severity:   { label: 'Assessing threat severity', detail: 'Analyzing IP reputation, timing, and attack patterns' },
  rotate_credentials:       { label: 'Rotating credentials', detail: 'Calling Auth0 Token Vault to invalidate real credentials' },
  generate_incident_report: { label: 'Generating incident report', detail: 'Compiling IOCs, timeline, and recommendations' },
  update_incident_status:   { label: 'Updating incident status', detail: 'Marking incident as investigating in database' },
};

export default function AgentLogPanel({ events, incidentId }) {
  const bottomRef = useRef(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!incidentId && events.length === 0) {
    return (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          gap: 16,
        }}>
          <div style={{ fontSize: 40 }}>🤖</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#7c5cbf', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>
              AI AGENT STANDING BY
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 11, lineHeight: 1.8 }}>
              When a honeytoken is triggered,<br />
              Claude will autonomously:
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                '🔍 Analyze the attack',
                '⚖️ Assess threat severity',
                '🔄 Rotate real credentials',
                '📋 Generate incident report',
              ].map((step, i) => (
                  <div key={i} style={{
                    fontSize: 11,
                    color: '#a78bfa',
                    background: 'rgba(124,92,191,0.08)',
                    padding: '4px 12px',
                    border: '1px solid rgba(124,92,191,0.2)',
                    textAlign: 'left',
                  }}>
                    {step}
                  </div>
              ))}
            </div>
            <div style={{ marginTop: 16, fontSize: 10, color: 'var(--muted)', opacity: 0.6 }}>
              Click ⚡ SIMULATE ATTACK to see it in action
            </div>
          </div>
        </div>
    );
  }

  return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0' }}>

        {/* Progress bar */}
        {events.length > 0 && !events.find(e => e.type === 'complete' || e.type === 'agent_complete') && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(124,92,191,0.1)', border: '1px solid rgba(124,92,191,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#a78bfa', marginBottom: 6 }}>
                <span>AGENT RUNNING</span>
                <span>{events.length} steps</span>
              </div>
              <div style={{ height: 3, background: 'rgba(124,92,191,0.2)', borderRadius: 2 }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #7c5cbf, #a78bfa)',
                  borderRadius: 2,
                  width: `${Math.min((events.length / 10) * 100, 90)}%`,
                  transition: 'width 0.5s ease',
                  animation: 'shimmer 1.5s infinite',
                }} />
              </div>
            </div>
        )}

        {/* Completion banner */}
        {events.find(e => e.type === 'complete' || e.type === 'agent_complete') && (
            <div style={{
              marginBottom: 12,
              padding: '10px 14px',
              background: 'rgba(48,209,88,0.1)',
              border: '1px solid rgba(48,209,88,0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <div style={{ fontSize: 11, color: '#30d158', fontWeight: 700, letterSpacing: '0.08em' }}>
                  THREAT NEUTRALIZED
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                  Credentials rotated · Incident report filed · {events.length} agent steps
                </div>
              </div>
            </div>
        )}

        {/* Event list */}
        {events.map((event) => {
          const style = EVENT_STYLES[event.type] || { icon: '○', color: 'var(--muted)', label: event.type, bg: 'transparent' };
          const toolInfo = event.tool ? TOOL_DESCRIPTIONS[event.tool] : null;
          const isExpanded = expanded[event.id];
          const hasDetail = event.text && event.text.length > 0;

          return (
              <div
                  key={event.id}
                  style={{
                    marginBottom: 8,
                    border: `1px solid ${style.color}30`,
                    background: style.bg,
                    animation: 'fadeIn 0.3s ease',
                    overflow: 'hidden',
                  }}
              >
                {/* Header row */}
                <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      cursor: hasDetail ? 'pointer' : 'default',
                    }}
                    onClick={() => hasDetail && toggleExpand(event.id)}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{style.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 9, letterSpacing: '0.15em', color: style.color, fontWeight: 700 }}>
                    {style.label}
                  </span>
                      {event.step && (
                          <span style={{ fontSize: 9, color: 'var(--muted)', opacity: 0.6 }}>
                      STEP {event.step}
                    </span>
                      )}
                    </div>

                    {/* Tool call info */}
                    {toolInfo && (
                        <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>
                          {toolInfo.label}
                        </div>
                    )}
                    {toolInfo && (
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                          {toolInfo.detail}
                        </div>
                    )}

                    {/* Message */}
                    {event.message && !toolInfo && (
                        <div style={{ fontSize: 11, color: 'var(--text)' }}>
                          {event.message}
                        </div>
                    )}

                    {/* Thinking preview */}
                    {event.text && !isExpanded && (
                        <div style={{
                          fontSize: 10,
                          color: 'var(--muted)',
                          marginTop: 4,
                          lineHeight: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {event.text}
                        </div>
                    )}
                  </div>

                  {/* Expand toggle */}
                  {hasDetail && (
                      <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                  {isExpanded ? '▲' : '▼'}
                </span>
                  )}
                </div>

                {/* Expanded reasoning */}
                {isExpanded && event.text && (
                    <div style={{
                      padding: '0 10px 10px 34px',
                      fontSize: 11,
                      color: '#c4c4d8',
                      lineHeight: 1.7,
                      borderTop: `1px solid ${style.color}20`,
                      paddingTop: 8,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {event.text}
                    </div>
                )}
              </div>
          );
        })}

        <div ref={bottomRef} style={{ height: 12 }} />

        <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { opacity: 1; }
          50% { opacity: 0.6; }
          100% { opacity: 1; }
        }
      `}</style>
      </div>
  );
}