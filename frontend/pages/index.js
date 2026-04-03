import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useHoneySocket } from '../lib/useHoneySocket';
import { fetchStats, fetchHoneytokens, fetchIncidents, triggerTestAttack } from '../lib/api';
import IncidentCard from '../components/IncidentCard';
import AgentLogPanel from '../components/AgentLogPanel';
import TokenVaultMap from '../components/TokenVaultMap';

function VaultStatusPanel() {
  const [status, setStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tokens/vault-status`);
      const data = await res.json();
      setStatus(data.users || []);
    } catch (e) {
      console.error(e);
      setError('Could not load vault status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
      <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.15em' }}>CONNECTED ACCOUNTS</span>
          <button
              onClick={load}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 9, padding: '2px 8px', cursor: 'pointer', letterSpacing: '0.1em' }}
          >
            REFRESH
          </button>
        </div>

        {loading ? (
            <div style={{ color: 'var(--muted)', fontSize: 11 }}>Loading...</div>
        ) : error ? (
            <div style={{ color: 'var(--critical)', fontSize: 11 }}>{error}</div>
        ) : status.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 11, lineHeight: 1.8 }}>
              No connected accounts yet.<br />
              <span style={{ fontSize: 10, opacity: 0.6 }}>Login with Google to see Token Vault credentials here.</span>
            </div>
        ) : (
            status.map((user, i) => (
                <div key={i} style={{
                  borderLeft: `3px solid ${user.googleConnected ? '#30d158' : '#ff2d55'}`,
                  padding: '8px 12px',
                  marginBottom: 8,
                  background: user.googleConnected ? 'rgba(48,209,88,0.05)' : 'rgba(255,45,85,0.05)',
                }}>
                  <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
              <span style={{ color: user.googleConnected ? '#30d158' : '#ff2d55' }}>
                {user.googleConnected ? '✅ Google Connected' : '❌ Google Unlinked'}
              </span>
                    <span style={{ color: user.tokenPresent ? '#30d158' : '#ff2d55' }}>
                {user.tokenPresent ? '🔑 Token Active' : '🔴 Token Rotated'}
              </span>
                  </div>
                  {user.lastRotated && (
                      <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>
                        Rotated: {new Date(user.lastRotated).toLocaleString()}
                      </div>
                  )}
                </div>
            ))
        )}
      </div>
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
        <div style={{ fontSize: 36, fontFamily: 'Orbitron, monospace', fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{sub}</div>
      </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [honeytokens, setHoneytokens] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [activeIncident, setActiveIncident] = useState(null);
  const [agentEvents, setAgentEvents] = useState([]);
  const [alertBanner, setAlertBanner] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [user, setUser] = useState(null);
  const [vaultUsers, setVaultUsers] = useState([]);
  const alertTimerRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
        .then(res => {
          if (!res.ok) {
            router.push('/login');
            return null;
          }
          return res.json();
        })
        .then(data => {
          if (!data) return;
          setUser(data);
        })
        .catch(() => {
          router.push('/login');
        });
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [s, h, i] = await Promise.all([
        fetchStats(),
        fetchHoneytokens(),
        fetchIncidents(),
      ]);
      setStats(s);
      setHoneytokens(h);
      setIncidents(i.incidents || []);

      const v = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tokens/vault-status`)
          .then(r => r.json());
      setVaultUsers(v.users || []);
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSocketEvent = useCallback((event) => {
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
          message: '🔄 Google OAuth token rotated — account blocked, sessions revoked',
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
              href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700;900&display=swap"
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
              <span style={{ fontSize: 10, color: 'var(--success)', letterSpacing: '0.1em' }}>
              {user ? '● CONNECTED' : ''}
            </span>
              <button
                  className="hv-btn-attack"
                  onClick={handleDemoAttack}
                  disabled={triggering}
              >
                {triggering ? 'SIMULATING...' : '⚡ SIMULATE ATTACK'}
              </button>
              <a
                  href="/api/auth/logout"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--muted)',
                    padding: '6px 14px',
                    textDecoration: 'none',
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
              >
                LOGOUT
              </a>
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

            {/* Left: Token Vault Map + Vault Status */}
            <section className="hv-panel hv-vault-panel">
              <div className="hv-panel-header">
                <span className="hv-panel-title">TOKEN VAULT</span>
                <span className="hv-panel-badge">REAL + DECOY</span>
              </div>
              <TokenVaultMap
                  honeytokens={honeytokens}
                  activeIncident={activeIncident}
                  vaultUsers={vaultUsers}
              />
              <VaultStatusPanel />
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
          @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700;900&display=swap');

          * { box-sizing: border-box; margin: 0; padding: 0; }

          :root {
            --bg: #020805;
            --surface: #030d05;
            --surface2: #061209;
            --border: rgba(0,255,65,0.15);
            --text: #9effa8;
            --muted: #2d6638;
            --accent: #00ff41;
            --critical: #ff2400;
            --warning: #ffaa00;
            --success: #00ff41;
            --ai: #00d4ff;
          }

          body {
            background: var(--bg);
            color: var(--text);
            font-family: 'Share Tech Mono', 'Space Mono', monospace;
            min-height: 100vh;
            background-image:
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 3px,
                rgba(0,255,65,0.018) 3px,
                rgba(0,255,65,0.018) 4px
              );
          }

          .hv-root {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            padding: 0;
          }

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
            font-family: 'Orbitron', monospace;
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 0.15em;
            color: var(--accent);
            text-shadow: 0 0 20px rgba(0,255,65,0.5);
          }
          .hv-tagline { font-size: 11px; color: var(--muted); letter-spacing: 0.1em; }
          .hv-header-right { display: flex; align-items: center; gap: 16px; }
          .hv-status-dot { width: 8px; height: 8px; border-radius: 50%; }
          .hv-status-dot.connected { background: var(--success); box-shadow: 0 0 8px var(--success); animation: pulse 2s infinite; }
          .hv-status-dot.disconnected { background: var(--muted); }
          .hv-status-label { font-size: 11px; letter-spacing: 0.1em; color: var(--muted); }

          .hv-btn-attack {
            background: transparent;
            border: 1px solid var(--critical);
            color: var(--critical);
            padding: 8px 18px;
            font-family: 'Share Tech Mono', monospace;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            cursor: pointer;
            clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%);
            transition: all 0.2s;
            text-shadow: 0 0 8px rgba(255,36,0,0.5);
          }
          .hv-btn-attack:disabled { opacity: 0.4; cursor: not-allowed; }
          .hv-btn-attack:not(:disabled):hover { background: var(--critical); color: #000; }

          .hv-stats-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1px;
            background: var(--border);
            border-bottom: 1px solid var(--border);
          }

          .hv-main-grid {
            display: grid;
            grid-template-columns: 280px 1fr 320px;
            gap: 1px;
            background: var(--border);
            flex: 1;
            height: 0;
            min-height: 500px;
          }

          .hv-panel {
            background: var(--surface);
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
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
            color: var(--accent);
            text-shadow: 0 0 8px rgba(0,255,65,0.3);
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
            max-height: calc(100vh - 280px);
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