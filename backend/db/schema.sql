-- HoneyVault PostgreSQL Schema

-- Honeytokens table: tracks all planted fake tokens
CREATE TABLE IF NOT EXISTS honeytokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     VARCHAR(255) UNIQUE NOT NULL,  -- Auth0 Token Vault client_id (fake)
  label         VARCHAR(255) NOT NULL,          -- e.g. "github-prod-honey-1"
  disguise_as   VARCHAR(255),                   -- Label it mimics (e.g. "github-prod")
  vault_token_id VARCHAR(255),                  -- Token Vault resource ID
  is_active     BOOLEAN DEFAULT true,
  triggered_at  TIMESTAMP,                      -- When first used by attacker
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Incidents table: each attack event detected
CREATE TABLE IF NOT EXISTS incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  honeytoken_id   UUID REFERENCES honeytokens(id),
  attacker_ip     VARCHAR(45),
  attacker_ua     TEXT,
  request_headers JSONB,
  raw_event       JSONB,                        -- Full webhook payload
  severity        VARCHAR(20) DEFAULT 'high',   -- low | medium | high | critical
  status          VARCHAR(20) DEFAULT 'open',   -- open | investigating | resolved
  ai_analysis     JSONB,                        -- Claude's structured threat report
  rotation_status VARCHAR(20) DEFAULT 'pending', -- pending | rotating | complete | failed
  rotated_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Real tokens table: tracks which real credentials need protecting
CREATE TABLE IF NOT EXISTS real_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label          VARCHAR(255) NOT NULL,          -- e.g. "github-prod"
  vault_token_id VARCHAR(255) NOT NULL,          -- Token Vault resource ID
  service        VARCHAR(100),                   -- e.g. "github", "stripe", "aws"
  last_rotated   TIMESTAMP,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- Agent logs: detailed AI reasoning trail
CREATE TABLE IF NOT EXISTS agent_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id),
  step        INTEGER NOT NULL,
  tool_name   VARCHAR(100),                     -- Claude tool call name
  tool_input  JSONB,
  tool_output JSONB,
  reasoning   TEXT,                             -- Claude's thinking
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_honeytokens_client_id ON honeytokens(client_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_incident ON agent_logs(incident_id);
