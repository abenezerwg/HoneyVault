# 🍯 HoneyVault

> **AI-Powered Deception Defense for OAuth Credentials**
>
> *Auth0 Token Vault Hackathon 2026 Submission*

[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://postgresql.org)
[![Auth0](https://img.shields.io/badge/Auth0-Token%20Vault-orange)](https://auth0.com)
[![Claude](https://img.shields.io/badge/Anthropic-Claude%20API-purple)](https://anthropic.com)

---

## What is HoneyVault?

HoneyVault plants fake OAuth credentials — **honeytokens** — in a secure database alongside real credentials protected by Auth0 Token Vault. Both look completely identical in the UI. An attacker who steals your credentials dump cannot tell which is real and which is a trap.

The moment they use a honeytoken, a **Claude AI agent** wakes up and autonomously:

1. Analyzes the attack — fetches full incident context
2. Assesses threat severity — scores the attack using IOC analysis
3. Rotates real credentials — calls Auth0 Management API to block the account and revoke all sessions stored in Token Vault
4. Generates an incident report — structured report with IOCs, timeline, and recommendations
5. Streams everything live — every reasoning step broadcasts to the dashboard via WebSocket in real time

**Start to finish — under 10 seconds. Fully autonomous. No human required.**

---

## Demo

```
User connects Google account → real OAuth token stored in Auth0 Token Vault
                    ↓
         3 honeytokens planted alongside it
                    ↓
        Attacker steals credentials dump
        Can't tell real from fake
                    ↓
         Attacker uses a honeytoken
                    ↓
          Webhook fires instantly
                    ↓
     Claude AI Agent wakes up autonomously
                    ↓
    ┌─── get_incident_context     ← who is the attacker?
    ├─── assess_threat_severity   ← how dangerous is this?
    ├─── rotate_credentials       ← block account, revoke sessions
    ├─── generate_incident_report ← document everything
    └─── update_incident_status   ← mark as investigating
                    ↓
     Real credential: ROTATED
     Attacker's stolen token: USELESS
     Time elapsed: < 10 seconds
```

---

## Architecture

### The Four Layers

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| **Trap** | PostgreSQL + Auth0 Token Vault | Honeytokens stored in DB, real tokens in Token Vault — indistinguishable in the UI |
| **Detection** | Auth0 Log Streams + Webhooks | Real-time trigger when a honeytoken is used — HMAC-SHA256 verified |
| **Agent** | Claude API + Tool Use | Autonomous 5-tool agentic loop — analyzes, rotates, reports |
| **Visibility** | Next.js + WebSockets | Live dashboard streams every agent step as it happens |

### Auth0 Token Vault Integration

Real Google OAuth tokens are stored automatically in Token Vault when users connect their Google account via Auth0's social connection. HoneyVault uses:

- **RFC 8693 Token Exchange** — to access Token Vault credentials
- **Auth0 Management API** — to block compromised accounts and revoke sessions
- **Auth0 Log Streams** — for real-time honeytoken usage detection

### AI Agent Tools

```javascript
// Claude autonomously calls these 5 tools in sequence
get_incident_context      // DB query — attack details, honeytoken, attacker IP
assess_threat_severity    // IOC analysis — returns severity score
rotate_credentials        // Auth0 Management API — block + revoke sessions
generate_incident_report  // Structured JSON report with IOCs + recommendations
update_incident_status    // DB update + WebSocket broadcast
```

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Auth & Security | Auth0, Auth0 Token Vault, Auth0 Management API, Auth0 Log Streams |
| AI | Anthropic Claude API (claude-opus-4-5), Claude Tool Use |
| Backend | Node.js, Express.js, WebSocket (ws) |
| Database | PostgreSQL |
| Frontend | Next.js 14, React 18 |
| Infrastructure | Docker, Railway (backend), Vercel (frontend) |
| Dev Tools | ngrok, nodemon, npm |

---

## Project Structure

```
honeyvault/
├── backend/
│   ├── server.js                  # Express + WebSocket server entry point
│   ├── routes/
│   │   ├── webhook.js             # Honeytoken trigger receiver (HMAC verified)
│   │   ├── tokens.js              # Honeytoken + real token management
│   │   └── incidents.js           # Incident history and reports
│   ├── services/
│   │   ├── aiAgent.js             # Claude agentic loop — 5 tools, autonomous
│   │   ├── tokenVault.js          # Auth0 Management API wrapper
│   │   └── notifier.js            # WebSocket broadcast service
│   ├── db/
│   │   ├── schema.sql             # PostgreSQL schema
│   │   └── client.js              # Connection pool + auto-migration
│   └── scripts/
│       ├── seedHoneytokens.js     # Plant honeytokens in DB
│       └── demoAttack.js          # Simulate attack for demo
├── frontend/
│   ├── pages/
│   │   ├── index.js               # Main dashboard
│   │   ├── incidents/[id].js      # Incident detail view
│   │   └── api/auth/[...auth0].js # Auth0 login/logout handler
│   ├── components/
│   │   ├── AgentLogPanel.js       # Live AI reasoning stream
│   │   ├── TokenVaultMap.js       # Real + decoy credential visualization
│   │   └── IncidentCard.js        # Incident summary card
│   └── lib/
│       ├── useHoneySocket.js      # WebSocket React hook
│       └── api.js                 # Backend API client
├── docker-compose.yml             # Local PostgreSQL
├── .env.example                   # Environment variable template
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker Desktop (for local PostgreSQL)
- Auth0 account with Token Vault enabled
- Anthropic API key
- Google OAuth app (for social connection)

### Step 1 — Clone and Install

```bash
git clone https://github.com/your-username/honeyvault
cd honeyvault

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### Step 2 — Environment Variables

```bash
# Root
cp .env.example .env

# Backend
cp .env.example backend/.env

# Frontend
cp frontend/.env.local.example frontend/.env.local
```

Fill in your values — see `.env.example` for all required variables.

### Step 3 — Auth0 Setup

1. Create a **Regular Web Application** in Auth0
2. Create a **Machine-to-Machine Application** with these Management API scopes:
   - `read:users`
   - `update:users`
   - `update:users_app_metadata`
   - `delete:sessions`
3. Enable **Google Social Connection** with Token Vault toggle ON
4. Add `http://localhost:3000/api/auth/callback` to Allowed Callback URLs

### Step 4 — Start the Database

```bash
docker-compose up postgres
```

### Step 5 — Run the App

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

### Step 6 — Seed Honeytokens

```bash
cd backend
npm run seed:honeytokens
```

### Step 7 — Connect Google Account

Go to `http://localhost:3000` and click **CONNECT GOOGLE** — this stores your real Google OAuth token in Auth0 Token Vault.

### Step 8 — Test the Attack Flow

```bash
cd backend
npm run demo:attack
```

Watch the dashboard at `http://localhost:3000` — the red alert fires, the AI agent reasons through the attack live, and credentials are rotated within 10 seconds.

---

## API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/webhook/honeytoken` | Main attack trigger (HMAC verified) |
| GET | `/api/tokens/honeytokens` | List all honeytokens |
| GET | `/api/tokens/vault-status` | Live Token Vault credential status |
| GET | `/api/tokens/stats` | Dashboard summary stats |
| GET | `/api/incidents` | Paginated incident list |
| GET | `/api/incidents/:id` | Full incident with AI analysis |
| POST | `/api/test/trigger-attack` | Simulate attack (dev only) |
| POST | `/api/tokens/unblock/:userId` | Reset user after demo |

### WebSocket Events

| Event | Description |
|-------|-------------|
| `honeytoken_triggered` | Attack detected — attacker IP, honeytoken label |
| `agent_thinking` | Claude reasoning step — live text |
| `agent_tool_call` | Tool being executed — name and step number |
| `credential_rotated` | Rotation confirmed |
| `agent_complete` | Analysis finished — full report |

---

## Environment Variables

```env
# Auth0
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your_app_client_id
AUTH0_CLIENT_SECRET=your_app_client_secret
AUTH0_M2M_CLIENT_ID=your_m2m_client_id
AUTH0_M2M_CLIENT_SECRET=your_m2m_client_secret
AUTH0_AUDIENCE=https://your-tenant.us.auth0.com/api/v2/

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/honeyvault

# App
PORT=3001
FRONTEND_URL=http://localhost:3000
WEBHOOK_SECRET=your_random_secret
```

---

## How the Deception Works

The probability that an attacker triggers a honeytoken before reaching a real credential is:

$$P(\text{trigger}) = 1 - \frac{\binom{k}{s}}{\binom{n+k}{s}}$$

Where $n$ = honeytokens, $k$ = real credentials, $s$ = credentials attempted.

With $n=3$ honeytokens and $k=1$ real token, an attacker trying $s=2$ credentials has a **70%+ chance of triggering a trap** before touching the real one.

---

## Demo Reset

Before each demo run, reset the state:

```bash
# Clear database
docker exec -it honeyvault_postgres_1 psql -U postgres -d honeyvault \
  -c "DELETE FROM agent_logs; DELETE FROM incidents; DELETE FROM honeytokens; DELETE FROM real_tokens;"

# Re-seed honeytokens
cd backend && npm run seed:honeytokens

# Unblock Auth0 user
curl -X POST http://localhost:3001/api/tokens/unblock/google-oauth2%7CYOUR_USER_ID
```

---

## Built With Vibe Coding

This project was built using vibe coding with Claude — AI-assisted development where architecture decisions, integrations, and debugging were directed and designed throughout the build process.

---

## License

MIT

---

*Built for the Auth0 Token Vault Hackathon 2026*

**Set the trap. Catch the attack. Rotate before they know. 🍯**