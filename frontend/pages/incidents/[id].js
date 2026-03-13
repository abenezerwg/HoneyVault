import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { fetchIncident } from '../../lib/api';
import { formatDistanceToNow, format } from 'date-fns';

export default function IncidentDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchIncident(id)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingScreen />;
  if (!data) return <div style={{ padding: 40, fontFamily: 'Space Mono', color: '#fff' }}>Incident not found</div>;

  const { incident, agentLogs } = data;
  const report = incident.ai_analysis;

  return (
    <>
      <Head>
        <title>Incident {id?.slice(0, 8)} — HoneyVault</title>
        <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ background: '#0a0a0f', minHeight: '100vh', color: '#e8e8f0', fontFamily: 'Space Mono, monospace', padding: '24px 32px' }}>
        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <Link href="/" style={{ color: '#ff6b35', textDecoration: 'none', fontSize: 12 }}>
            ← DASHBOARD
          </Link>
          <span style={{ color: '#333' }}>/</span>
          <span style={{ fontSize: 12, color: '#6b6b8a' }}>INCIDENT {id?.slice(0, 8).toUpperCase()}</span>
        </div>

        {/* Header */}
        <div style={{ borderLeft: '4px solid #ff2d55', paddingLeft: 20, marginBottom: 32 }}>
          <div style={{ fontSize: 10, color: '#ff2d55', letterSpacing: '0.2em', marginBottom: 8 }}>
            {incident.severity?.toUpperCase()} SEVERITY INCIDENT
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
            Honeytoken Triggered
          </div>
          <div style={{ fontSize: 12, color: '#6b6b8a' }}>
            {format(new Date(incident.created_at), 'PPpp')} ·{' '}
            {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* Attack Details */}
          <Section title="ATTACK DETAILS">
            <Field label="Attacker IP" value={incident.attacker_ip || 'Unknown'} highlight />
            <Field label="User Agent" value={incident.attacker_ua || 'Unknown'} />
            <Field label="Honeytoken" value={incident.honey_label} />
            <Field label="Disguised As" value={incident.disguise_as} />
            <Field label="Rotation Status" value={incident.rotation_status?.toUpperCase()} color="#30d158" />
          </Section>

          {/* AI Assessment */}
          {report && (
            <Section title="AI THREAT ASSESSMENT">
              <Field label="Severity" value={report.severity?.toUpperCase()} color="#ff2d55" />
              <Field label="Summary" value={report.attack_summary} multiline />
              {report.attacker_profile && (
                <Field label="Attacker Profile" value={report.attacker_profile} multiline />
              )}
            </Section>
          )}
        </div>

        {/* IOCs */}
        {report?.indicators_of_compromise?.length > 0 && (
          <Section title="INDICATORS OF COMPROMISE" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {report.indicators_of_compromise.map((ioc, i) => (
                <span key={i} style={{
                  background: 'rgba(255,45,85,0.1)',
                  border: '1px solid rgba(255,45,85,0.3)',
                  padding: '4px 10px',
                  fontSize: 11,
                  color: '#ff6b35',
                }}>
                  {ioc}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Recommendations */}
        {report?.recommendations?.length > 0 && (
          <Section title="RECOMMENDATIONS" style={{ marginBottom: 24 }}>
            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
              {report.recommendations.map((rec, i) => (
                <li key={i} style={{ fontSize: 12, color: '#e8e8f0', marginBottom: 6, lineHeight: 1.6 }}>
                  {rec}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Agent Audit Log */}
        {agentLogs.length > 0 && (
          <Section title={`AI AGENT AUDIT LOG (${agentLogs.length} steps)`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {agentLogs.map(log => (
                <div key={log.id} style={{
                  borderLeft: '2px solid #7c5cbf',
                  paddingLeft: 12,
                  paddingTop: 4,
                  paddingBottom: 4,
                }}>
                  <div style={{ fontSize: 10, color: '#7c5cbf', marginBottom: 4 }}>
                    STEP {log.step} · {log.tool_name || 'reasoning'}
                  </div>
                  {log.tool_input && (
                    <pre style={{ fontSize: 10, color: '#6b6b8a', overflow: 'auto', maxHeight: 60 }}>
                      {JSON.stringify(log.tool_input, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </>
  );
}

function Section({ title, children, style = {} }) {
  return (
    <div style={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', padding: 20, ...style }}>
      <div style={{ fontSize: 9, letterSpacing: '0.2em', color: '#6b6b8a', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, highlight, color, multiline }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: '#6b6b8a', letterSpacing: '0.12em', marginBottom: 3 }}>{label}</div>
      <div style={{
        fontSize: multiline ? 11 : 12,
        color: color || (highlight ? '#ff6b35' : '#e8e8f0'),
        lineHeight: multiline ? 1.7 : 1.4,
      }}>
        {value || '—'}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      background: '#0a0a0f', minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#6b6b8a', fontFamily: 'Space Mono, monospace', fontSize: 12,
    }}>
      Loading incident data...
    </div>
  );
}
