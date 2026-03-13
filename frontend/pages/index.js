import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { useHoneySocket } from '../lib/useHoneySocket';
import { fetchStats, fetchHoneytokens, fetchIncidents, triggerTestAttack } from '../lib/api';
import IncidentCard from '../components/IncidentCard';
import AgentLogPanel from '../components/AgentLogPanel';
import TokenVaultMap from '../components/TokenVaultMap';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [honeytokens, setHoneytokens] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [activeIncident, setActiveIncident] = useState(null);
  const [agentEvents, setAgentEvents] = useState([]);
  const [alertBanner, setAlertBanner] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const alertTimerRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const [s, h, i] = await Promise.all([fetchStats(), fetchHoneytokens(), fetchIncidents()]);
      setStats(s);
      setHoneytokens(h);
      setIncidents(i.incidents || []);
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSocketEvent = useCallback((event) => {
    console.log('[Dashboard] WS event:', event.type);

    switch (event.type) {
      case 'honeytoken_triggered':
        setAlertBanner({
          type: 'critical',
          message: `🚨 HONEYTOKEN TRIGGERED — Attacker IP: ${event.attackerIp}`,
          incidentId: event.incidentId,
        });
        clearTimeout(alertTimerRef.current);
        setActiveIncident(event.incidentId);
        setAgentEvents([]);
        loadData();
        break;

      case 'agent_started':
      case 'agent_thinking':
      case 'agent_tool_call':
        setAgentEvents(prev => [...prev, { ...event, id: Date.now() }]);
        break;

      case 'credential_rotated':
        setAgentEvents(prev => [...prev, {
          type: 'rotation',
          message: `🔄 Credential rotated: ${event.tokenId}`,
          id: Date.now(),
        }]);
        break;

      case 'agent_complete':
        setAgentEvents(prev => [...prev, {
          type: 'complete',
          message: '✅ Threat analysis complete. Credentials secured.',
          id: Date.now(),
        }]);
        alertTimerRef.current = setTimeout(() => setAlertBanner(null), 30000);
        loadData();
        break;
    }
  }, [loadData]);

  const { connected } = useHoneySocket(handleSocketEvent);

  const handleDemoAttack = async () => {
    setTriggering(true);
    try {
      await triggerTestAttack();
    } catch (e) {
      alert('Attack trigger failed — is the backend running?');
    } finally {
      setTriggering(false);
    }
  };

  return (
    <>
      <Head>
        <title>HoneyVault — Deception Defense</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="hv-root">
        {/* Alert Banner */}
        {alertBanner && (
          <div className="hv-alert-banner">
            <span className="hv-alert-pulse" />
            <span>{alertBanner.message}</span>
            <button onClick={() => setAlertBanner(null)}>×</button>
          </div>
        )}

        {/* Header */}
        <header className="hv-header">
          <div className="hv-header-left">
            <div className="hv-logo">
              <span className="hv-logo-icon">🍯</span>
              <span className="hv-logo-text">HONEYVAULT</span>
            </div>
            <div className="hv-tagline">AI-Powered Deception Defense</div>
          </div>

          <div className="hv-header-right">
            <div className={`hv-status-dot ${connected ? 'connected' : 'disconnected'}`} />
            <span className="hv-status-label">{connected ? 'LIVE' : 'OFFLINE'}</span>

            <button
              className="hv-btn-attack"
              onClick={handleDemoAttack}
              disabled={triggering}
            >
              {triggering ? 'SIMULATING...' : '⚡ SIMULATE ATTACK'}
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="hv-stats-row">
          <StatCard
            label="HONEYTOKENS ACTIVE"
            value={stats?.honeytokens?.active ?? '—'}
            sub={`${stats?.honeytokens?.triggered ?? 0} triggered`}
            accent="#ff6b35"
          />
          <StatCard
            label="INCIDENTS"
            value={stats?.incidents?.total ?? '—'}
            sub={`${stats?.incidents?.open ?? 0} open`}
            accent="#ff2d55"
          />
          <StatCard
            label="LAST 24H"
            value={stats?.incidents?.last_24h ?? '0'}
            sub="attacks detected"
            accent="#ffd60a"
          />
          <StatCard
            label="CREDENTIALS"
            value={stats?.honeytokens?.total ?? '—'}
            sub="real tokens protected"
            accent="#30d158"
          />
        </div>

        {/* Main Grid */}
        <div className="hv-main-grid">
          {/* Left: Token Vault Map */}
          <section className="hv-panel hv-vault-panel">
            <div className="hv-panel-header">
              <span className="hv-panel-title">TOKEN VAULT</span>
              <span className="hv-panel-badge">REAL + DECOY</span>
            </div>
            <TokenVaultMap honeytokens={honeytokens} activeIncident={activeIncident} />
          </section>

          {/* Center: Live Feed */}
          <section className="hv-panel hv-feed-panel">
            <div className="hv-panel-header">
              <span className="hv-panel-title">INCIDENT FEED</span>
              <span className="hv-count">{incidents.length}</span>
            </div>
            <div className="hv-incident-list">
              {incidents.length === 0 ? (
                <div className="hv-empty">No incidents. Honeytokens are waiting...</div>
              ) : (
                incidents.map(inc => (
                  <IncidentCard
                    key={inc.id}
                    incident={inc}
                    active={inc.id === activeIncident}
                    onClick={() => setActiveIncident(inc.id === activeIncident ? null : inc.id)}
                  />
                ))
              )}
            </div>
          </section>

          {/* Right: AI Agent Log */}
          <section className="hv-panel hv-agent-panel">
            <div className="hv-panel-header">
              <span className="hv-panel-title">AI AGENT</span>
              <span className="hv-panel-badge ai-badge">CLAUDE</span>
            </div>
            <AgentLogPanel events={agentEvents} incidentId={activeIncident} />
          </section>
        </div>

        <style jsx global>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }

          :root {
            --bg: #0a0a0f;
            --surface: #12121a;
            --surface2: #1a1a26;
            --border: rgba(255,255,255,0.08);
            --text: #e8e8f0;
            --muted: #6b6b8a;
            --accent: #ff6b35;
            --critical: #ff2d55;
            --warning: #ffd60a;
            --success: #30d158;
            --ai: #7c5cbf;
          }

          body {
            background: var(--bg);
            color: var(--text);
            font-family: 'Space Mono', monospace;
            min-height: 100vh;
          }

          .hv-root {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            padding: 0;
          }

          /* Alert Banner */
          .hv-alert-banner {
            display: flex;
            align-items: center;
            gap: 12px;
            background: var(--critical);
            color: #fff;
            padding: 12px 24px;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.05em;
            animation: slideDown 0.3s ease;
          }
          .hv-alert-banner button {
            margin-left: auto;
            background: none;
            border: none;
            color: #fff;
            font-size: 20px;
            cursor: pointer;
            opacity: 0.7;
          }
          .hv-alert-pulse {
            width: 10px; height: 10px;
            border-radius: 50%;
            background: #fff;
            animation: pulse 1s infinite;
            flex-shrink: 0;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.5); }
          }
          @keyframes slideDown {
            from { transform: translateY(-100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }

          /* Header */
          .hv-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 24px;
            border-bottom: 1px solid var(--border);
            background: var(--surface);
          }
          .hv-header-left { display: flex; align-items: center; gap: 20px; }
          .hv-logo { display: flex; align-items: center; gap: 10px; }
          .hv-logo-icon { font-size: 24px; }
          .hv-logo-text {
            font-family: 'Syne', sans-serif;
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 0.15em;
            background: linear-gradient(135deg, #ff6b35, #ff2d55);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .hv-tagline { font-size: 11px; color: var(--muted); letter-spacing: 0.1em; }
          .hv-header-right { display: flex; align-items: center; gap: 16px; }
          .hv-status-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
          }
          .hv-status-dot.connected { background: var(--success); box-shadow: 0 0 8px var(--success); animation: pulse 2s infinite; }
          .hv-status-dot.disconnected { background: var(--muted); }
          .hv-status-label { font-size: 11px; letter-spacing: 0.1em; color: var(--muted); }

          .hv-btn-attack {
            background: linear-gradient(135deg, #ff6b35, #ff2d55);
            border: none;
            color: #fff;
            padding: 8px 18px;
            font-family: 'Space Mono', monospace;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            cursor: pointer;
            clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
            transition: opacity 0.2s;
          }
          .hv-btn-attack:disabled { opacity: 0.5; cursor: not-allowed; }
          .hv-btn-attack:not(:disabled):hover { opacity: 0.85; }

          /* Stats */
          .hv-stats-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1px;
            background: var(--border);
            border-bottom: 1px solid var(--border);
          }

          /* Main Grid */
          .hv-main-grid {
            display: grid;
            grid-template-columns: 280px 1fr 320px;
            gap: 1px;
            background: var(--border);
            flex: 1;
          }

          .hv-panel {
            background: var(--surface);
            display: flex;
            flex-direction: column;
            min-height: 0;
          }
          .hv-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
            background: var(--surface2);
          }
          .hv-panel-title {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.2em;
            color: var(--muted);
          }
          .hv-panel-badge {
            font-size: 9px;
            padding: 2px 8px;
            border: 1px solid var(--border);
            color: var(--muted);
            letter-spacing: 0.1em;
          }
          .hv-panel-badge.ai-badge { border-color: var(--ai); color: var(--ai); }
          .hv-count {
            font-size: 11px;
            background: var(--surface2);
            border: 1px solid var(--border);
            padding: 1px 8px;
            color: var(--text);
          }

          .hv-incident-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
          }
          .hv-incident-list::-webkit-scrollbar { width: 4px; }
          .hv-incident-list::-webkit-scrollbar-track { background: var(--surface); }
          .hv-incident-list::-webkit-scrollbar-thumb { background: var(--border); }

          .hv-empty {
            padding: 40px 20px;
            text-align: center;
            color: var(--muted);
            font-size: 12px;
            line-height: 1.8;
          }
        `}</style>
      </div>
    </>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: 'var(--surface)',
      padding: '20px 24px',
      borderLeft: `3px solid ${accent}`,
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--muted)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 36, fontFamily: 'Syne, sans-serif', fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{sub}</div>
    </div>
  );
}
