# 🍯 HoneyVault — AI-Powered Deception Defense

> Plant fake OAuth tokens (honeytokens) alongside real credentials in Auth0 Token Vault.
> When an attacker steals and uses one, your AI Agent wakes up, rotates real secrets, and files an incident report — automatically.

---

## Architecture Overview

```
Auth0 Login → Token Vault stores real + honey tokens
                        ↓
             Attacker steals honeytoken
                        ↓
              Honeytoken used → Webhook fires
                        ↓
               AI Agent (Claude) analyzes attack
                        ↓
           Token Vault rotates ALL real credentials
                        ↓
         Incident report generated + Dashboard alerts
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Auth | Auth0 + Token Vault |
| AI Agent | Anthropic Claude API (tool use) |
| Backend | Node.js + Express + PostgreSQL |
| Frontend | Next.js + Tailwind CSS + WebSockets |
| Deployment | Vercel (frontend) + Railway (backend) |

---

## Step-by-Step Setup

### Step 1 — Clone & Install

```bash
git clone <your-repo>
cd honeyvault

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### Step 2 — Auth0 Configuration

1. Create an Auth0 account at https://auth0.com
2. Create a new **Regular Web Application**
3. Note your: `Domain`, `Client ID`, `Client Secret`
4. Enable **Token Vault** in your Auth0 Dashboard:
   - Go to Security → Token Vault
   - Enable it for your application
5. Create a **Machine-to-Machine Application** for backend API access
   - Grant it `read:token_vault`, `create:token_vault`, `delete:token_vault` scopes

### Step 3 — Configure Environment Variables

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
# Auth0
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=xxx
AUTH0_CLIENT_SECRET=xxx
AUTH0_M2M_CLIENT_ID=xxx          # Machine-to-machine app
AUTH0_M2M_CLIENT_SECRET=xxx
AUTH0_AUDIENCE=https://your-tenant.us.auth0.com/api/v2/

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# Database (Railway PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/honeyvault

# App
PORT=3001
FRONTEND_URL=http://localhost:3000
WEBHOOK_SECRET=your-random-secret-here

# For ngrok during dev (webhook receiver)
NGROK_URL=https://xxx.ngrok.io
```

### Step 4 — Initialize Database

```bash
cd backend
npm run db:migrate
```

### Step 5 — Run Dev Server

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 — Expose webhook (dev only):**
```bash
npx ngrok http 3001
# Copy the HTTPS URL into NGROK_URL in your .env
```

### Step 6 — Seed Honeytokens

```bash
cd backend
npm run seed:honeytokens
```

This will:
- Connect to Token Vault via Auth0 Management API
- Create 3 fake "honeytoken" OAuth credentials alongside real ones
- Register each honeytoken's `client_id` in your database

### Step 7 — Test the Attack Flow

```bash
# Simulate an attacker using a stolen honeytoken
curl -X POST http://localhost:3001/api/test/trigger-attack \
  -H "Content-Type: application/json" \
  -d '{"honeytokenId": "test_honey_001", "attackerIp": "1.2.3.4"}'
```

Watch the dashboard at `http://localhost:3000` for the real-time alert.

---

## Project Structure

```
honeyvault/
├── backend/
│   ├── server.js               # Express app entry point
│   ├── routes/
│   │   ├── webhook.js          # Receives honeytoken trigger events
│   │   ├── tokens.js           # Token Vault CRUD + honeytoken management
│   │   └── incidents.js        # Incident history & reports
│   ├── services/
│   │   ├── aiAgent.js          # Claude AI threat analysis (tool use)
│   │   ├── tokenVault.js       # Auth0 Token Vault API wrapper
│   │   └── notifier.js         # WebSocket broadcast service
│   ├── db/
│   │   ├── schema.sql          # PostgreSQL schema
│   │   └── client.js           # DB connection pool
│   ├── middleware/
│   │   └── auth.js             # Auth0 JWT verification
│   └── scripts/
│       └── seedHoneytokens.js  # One-time honeytoken seeding
├── frontend/
│   ├── pages/
│   │   ├── index.js            # Main dashboard
│   │   └── incidents/[id].js   # Incident detail view
│   ├── components/
│   │   ├── ThreatFeed.js       # Live attack event stream
│   │   ├── TokenMap.js         # Visual token vault map
│   │   ├── IncidentCard.js     # Incident summary card
│   │   └── AgentLog.js         # AI agent reasoning log
│   └── lib/
│       └── socket.js           # WebSocket client
├── .env.example
└── docker-compose.yml
```

---

## How Honeytokens Work

Real credentials in Token Vault look like:
```json
{ "client_id": "real_abc123", "client_secret": "...", "label": "github-prod" }
```

Honeytokens look identical but are tagged in your DB:
```json
{ "client_id": "honey_xyz789", "client_secret": "fake-but-valid-looking", "label": "github-prod" }
```

An attacker who exfiltrates credentials can't tell which is real. The moment they use `honey_xyz789`, your webhook fires.

---

## Demo Script (3 minutes)

1. **Show dashboard** — 3 honeytokens planted, 0 incidents
2. **Trigger attack** — `npm run demo:attack`
3. **Watch live** — Webhook → AI Agent → rotation → alert, all in ~8 seconds
4. **Show incident report** — AI-generated threat summary with IOCs
5. **Show Token Vault** — real credentials have been rotated, honeytoken still active as a trap
