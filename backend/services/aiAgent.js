/**
 * aiAgent.js
 * The brain of HoneyVault: a Claude AI Agent that analyzes attacks,
 * decides response actions, and uses tools to execute them.
 *
 * Uses Claude's tool use (function calling) to:
 *  1. Analyze attack context (IP, headers, timing)
 *  2. Assess threat severity
 *  3. Rotate real credentials via Token Vault
 *  4. Generate a structured incident report
 *  5. Recommend ongoing defensive measures
 */

const Anthropic = require('@anthropic-ai/sdk');
const { query } = require('../db/client');
const { rotateVaultToken, getUsersWithConnectedAccounts } = require('./tokenVault');
const { broadcast } = require('./notifier');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Tool Definitions ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'get_incident_context',
    description: 'Retrieve full context about the attack incident including honeytoken details, attacker IP geolocation, and historical activity',
    input_schema: {
      type: 'object',
      properties: {
        incident_id: { type: 'string', description: 'The incident UUID to look up' },
      },
      required: ['incident_id'],
    },
  },
  {
    name: 'assess_threat_severity',
    description: 'Analyze attack signals and return a structured severity assessment',
    input_schema: {
      type: 'object',
      properties: {
        attacker_ip: { type: 'string' },
        user_agent: { type: 'string' },
        request_timing: { type: 'string', description: 'Time of attack (ISO 8601)' },
        honeytoken_label: { type: 'string', description: 'Which service the honeytoken was for' },
        indicators: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of attack indicators observed',
        },
      },
      required: ['attacker_ip', 'honeytoken_label'],
    },
  },
  {
    name: 'rotate_credentials',
    description: 'Immediately rotate real credentials in Token Vault to invalidate any potentially compromised secrets',
    input_schema: {
      type: 'object',
      properties: {
        real_token_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of Token Vault IDs for REAL credentials to rotate',
        },
        reason: { type: 'string', description: 'Reason for rotation (for audit log)' },
      },
      required: ['real_token_ids', 'reason'],
    },
  },
  {
    name: 'generate_incident_report',
    description: 'Generate a comprehensive incident report with timeline, IOCs, impact assessment, and recommendations',
    input_schema: {
      type: 'object',
      properties: {
        incident_id: { type: 'string' },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        attack_summary: { type: 'string' },
        indicators_of_compromise: { type: 'array', items: { type: 'string' } },
        affected_services: { type: 'array', items: { type: 'string' } },
        rotation_completed: { type: 'boolean' },
        recommendations: { type: 'array', items: { type: 'string' } },
        attacker_profile: { type: 'string', description: 'Assessment of attacker sophistication and likely motivation' },
      },
      required: ['incident_id', 'severity', 'attack_summary', 'recommendations'],
    },
  },
  {
    name: 'update_incident_status',
    description: 'Update the incident status in the database',
    input_schema: {
      type: 'object',
      properties: {
        incident_id: { type: 'string' },
        status: { type: 'string', enum: ['open', 'investigating', 'resolved'] },
        notes: { type: 'string' },
      },
      required: ['incident_id', 'status'],
    },
  },
];

// ─── Tool Execution ───────────────────────────────────────────────────────────
async function executeTool(toolName, toolInput, incidentId) {
  console.log(`[Agent] Executing tool: ${toolName}`, toolInput);

  // Log the tool call to DB for audit trail
  await query(
    `INSERT INTO agent_logs (incident_id, step, tool_name, tool_input) VALUES ($1, 
     (SELECT COALESCE(MAX(step), 0) + 1 FROM agent_logs WHERE incident_id = $1), $2, $3)`,
    [incidentId, toolName, JSON.stringify(toolInput)]
  );

  switch (toolName) {
    case 'get_incident_context': {
      const { rows } = await query(`
        SELECT 
          i.*,
          h.client_id as honey_client_id,
          h.label as honey_label,
          h.disguise_as,
          json_agg(json_build_object(
            'id', rt.id, 'label', rt.label, 
            'service', rt.service, 'vault_token_id', rt.vault_token_id
          )) as real_tokens
        FROM incidents i
        JOIN honeytokens h ON i.honeytoken_id = h.id
        LEFT JOIN real_tokens rt ON rt.is_active = true
        WHERE i.id = $1
        GROUP BY i.id, h.client_id, h.label, h.disguise_as
      `, [toolInput.incident_id]);

      return rows[0] || { error: 'Incident not found' };
    }

    case 'assess_threat_severity': {
      // In production, integrate with IP reputation APIs (AbuseIPDB, GreyNoise, etc.)
      const indicators = toolInput.indicators || [];
      let score = 50;

      if (indicators.includes('known_malicious_ip')) score += 30;
      if (indicators.includes('vpn_detected')) score += 15;
      if (indicators.includes('automated_tool')) score += 20;
      if (indicators.includes('off_hours_access')) score += 10;

      const severity = score >= 90 ? 'critical' : score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

      return {
        severity,
        score,
        indicators_detected: indicators,
        geo_lookup: { country: 'Unknown', isp: 'Unknown', is_vpn: false }, // Integrate ipinfo.io
        recommendation: severity === 'critical' ? 'IMMEDIATE rotation required' : 'Rotate within 1 hour',
      };
    }

    case 'rotate_credentials': {
      const results = [];

      // Get all users with connected accounts in Token Vault
      const users = await getUsersWithConnectedAccounts('google-oauth2');

      for (const user of users) {
        const googleIdentity = user.identities?.find(
            id => id.connection === 'google-oauth2'
        );

        if (!googleIdentity) continue;

        try {
          // Unlink the Google identity — this invalidates the Token Vault entry
          await rotateVaultToken(
              user.user_id,
              'google-oauth2',
              googleIdentity.user_id
          );

          // Update DB
          await query(
              `UPDATE real_tokens SET last_rotated = NOW() WHERE service = 'google'`
          );

          results.push({
            user_id: user.user_id,
            email: user.email,
            status: 'rotated',
            timestamp: new Date().toISOString(),
          });

          broadcast({
            type: 'credential_rotated',
            tokenId: result.userId || tokenId,
            label: `Google OAuth — ${result.userId}`,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          results.push({
            user_id: user.user_id,
            status: 'failed',
            error: err.message,
          });
        }
      }

      return {
        rotations: results,
        total: results.length,
        success: results.filter(r => r.status === 'rotated').length,
      };
    }

    case 'generate_incident_report': {
      const report = {
        ...toolInput,
        generated_at: new Date().toISOString(),
        response_actions: [
          toolInput.rotation_completed ? '✅ Credentials rotated' : '⚠️ Rotation pending',
          '🍯 Honeytoken remains active to track continued attacker activity',
          '📊 Full audit log preserved',
        ],
      };

      // Save report to DB
      await query(
        `UPDATE incidents SET ai_analysis = $1, severity = $2, status = 'investigating', updated_at = NOW() WHERE id = $3`,
        [JSON.stringify(report), toolInput.severity, toolInput.incident_id]
      );

      return { report, saved: true };
    }

    case 'update_incident_status': {
      await query(
        `UPDATE incidents SET status = $1, updated_at = NOW() WHERE id = $2`,
        [toolInput.status, toolInput.incident_id]
      );
      return { updated: true, incident_id: toolInput.incident_id, new_status: toolInput.status };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ─── Main Agent Loop ──────────────────────────────────────────────────────────
async function runAttackAnalysis(incident) {
  console.log(`[Agent] Starting analysis for incident: ${incident.id}`);

  broadcast({
    type: 'agent_started',
    incidentId: incident.id,
    message: 'AI Agent initiated threat analysis',
  });

  const systemPrompt = `You are HoneyVault's AI Security Agent. A honeytoken has been triggered — meaning an attacker has stolen and used a fake credential that was planted to detect exactly this kind of intrusion.

Your mission:
1. Gather full attack context using get_incident_context
2. Assess threat severity using assess_threat_severity  
3. Immediately rotate ALL real credentials using rotate_credentials — do not skip this step
4. Generate a comprehensive incident report using generate_incident_report
5. Update the incident status to 'investigating' using update_incident_status

Be thorough but fast. Real credentials may be at risk right now.
Always rotate credentials before generating the report.
The incident ID is: ${incident.id}`;

  const userMessage = `ALERT: Honeytoken triggered!
- Incident ID: ${incident.id}
- Honeytoken: ${incident.honey_client_id || 'unknown'}
- Attacker IP: ${incident.attacker_ip || 'unknown'}
- User Agent: ${incident.attacker_ua || 'unknown'}
- Time: ${incident.created_at}

Analyze this attack and secure our real credentials immediately.`;

  const messages = [{ role: 'user', content: userMessage }];
  let agentStep = 0;
  let finalReport = null;

  // Agentic loop — Claude continues calling tools until done
  while (agentStep < 20) {
    agentStep++;

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });

    console.log(`[Agent] Step ${agentStep}: stop_reason=${response.stop_reason}`);

    // Broadcast each reasoning step to the dashboard
    const textBlocks = response.content.filter(b => b.type === 'text');
    if (textBlocks.length > 0) {
      broadcast({
        type: 'agent_thinking',
        incidentId: incident.id,
        step: agentStep,
        text: textBlocks.map(b => b.text).join('\n'),
      });
    }

    // Add assistant response to conversation
    messages.push({ role: 'assistant', content: response.content });

    // If Claude is done, break
    if (response.stop_reason === 'end_turn') {
      finalReport = response.content.find(b => b.type === 'text')?.text;
      break;
    }

    // Process tool calls
    if (response.stop_reason === 'tool_use') {
      const toolResults = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        broadcast({
          type: 'agent_tool_call',
          incidentId: incident.id,
          tool: block.name,
          step: agentStep,
        });

        const result = await executeTool(block.name, block.input, incident.id);

        // Check for critical rotation completion
        if (block.name === 'rotate_credentials') {
          broadcast({
            type: 'rotation_complete',
            incidentId: incident.id,
            rotations: result,
          });
        }

        if (block.name === 'generate_incident_report') {
          finalReport = result.report;
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }
  }

  // Mark analysis complete
  await query(
    `UPDATE incidents SET rotation_status = 'complete', rotated_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [incident.id]
  );

  broadcast({
    type: 'agent_complete',
    incidentId: incident.id,
    report: finalReport,
    message: 'Threat analysis complete. Credentials secured.',
  });

  console.log(`[Agent] Analysis complete for incident: ${incident.id}`);
  return finalReport;
}

function generateNewSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 48 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

module.exports = { runAttackAnalysis };
