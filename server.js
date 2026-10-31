const express = require('express');
const cron = require('node-cron');
const { runAllPayloads, payloadLabel, payloads } = require('./paymentRunner');
const { buildContexts } = require('./environments');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. ENVIRONMENT CONTEXTS ---
// One context per environment (Integration, Cert, Release, UAT), each with its own
// Cybersource client, card numbers and logs. Logs are in memory and reset on restart.
const contexts = buildContexts();

function addLog(ctx, type, status, detail, transactionId = 'N/A') {
  const entry = {
    timestamp: new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
    type: type, // 'AUTO' or 'MANUAL'
    status: status,
    detail: detail,
    transactionId: transactionId
  };
  ctx.logs.unshift(entry); // Add new logs to the top
  if (ctx.logs.length > 200) ctx.logs.pop(); // Keep only the last 200 per environment
}

// Logs one payload result; returns true if authorized
function logResult(ctx, type, payload, index, result, err) {
  const label = payloadLabel(payload, index);
  if (err) {
    addLog(ctx, type, 'ERROR', `${label}: ${err.message}`);
    console.error(`💥 [${ctx.name}] ${label} Error:`, err.message);
    return false;
  }
  const isAuth = result.status === 'AUTHORIZED';
  addLog(ctx, type, isAuth ? 'SUCCESS' : 'DECLINED', isAuth ? label : `${label}: ${result.status}`, result.id || 'N/A');
  console.log(isAuth ? `✅ [${ctx.name}] ${label} Success: ${result.id}` : `⚠️ [${ctx.name}] ${label} Declined: ${result.status}`);
  return isAuth;
}

// Runs all payloads for one environment; skips if a run is already in progress there
async function runContext(ctx, type) {
  if (ctx.running) {
    console.warn(`⏭️ [${ctx.name}] ${type} skipped: previous run still in progress`);
    return { environment: ctx.name, skipped: true, results: [] };
  }
  ctx.running = true;
  console.log(`[${new Date().toISOString()}] ${type === 'AUTO' ? '🕒' : '⚡'} [${ctx.name}] ${type}: Running ${payloads.length} payloads...`);
  const results = [];
  try {
    await runAllPayloads(ctx, (p, i, result, err) => {
      const ok = logResult(ctx, type, p, i, result, err);
      results.push({ index: i + 1, reference: payloadLabel(p, i), ok, status: err ? 'ERROR' : result.status, id: result?.id || null, error: err?.message });
    });
  } finally {
    ctx.running = false;
  }
  return { environment: ctx.name, skipped: false, results };
}

// --- 2. SCHEDULED TASKS ---
// One cron per environment, all on the same schedule; each tick runs every payload in payloads.json
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 */6 * * *';

for (const ctx of contexts) {
  cron.schedule(CRON_SCHEDULE, () => runContext(ctx, 'AUTO'), {
    scheduled: true,
    timezone: "America/New_York"
  });
}

// --- 3. WEB ROUTES ---

// Dashboard View: one tab per environment, selected with ?env=<key>
// (kept in the URL so the 30s auto-refresh stays on the same tab)
app.get('/', (req, res) => {
  const active = contexts.find(c => c.key === String(req.query.env || '').toLowerCase()) || contexts[0];

  const tabs = contexts.map(ctx => {
    const counts = { success: 0, declined: 0, error: 0 };
    ctx.logs.forEach(log => counts[log.status.toLowerCase()]++);
    return `
      <a class="tab ${ctx === active ? 'active' : ''}" href="/?env=${ctx.key}">
        ${ctx.name}${ctx.running ? ' ⏳' : ''}
        <span class="badges">
          <span class="badge badge-success" title="Success">${counts.success}</span>
          <span class="badge badge-declined" title="Declined">${counts.declined}</span>
          <span class="badge badge-error" title="Error">${counts.error}</span>
        </span>
      </a>
    `;
  }).join('');

  let section = '';
  if (active) {
    const rows = active.logs.map(log => `
      <tr>
        <td>${log.timestamp}</td>
        <td><strong>${log.type}</strong></td>
        <td><span class="status-${log.status.toLowerCase()}">${log.status}</span></td>
        <td>${log.detail}</td>
        <td><code>${log.transactionId}</code></td>
      </tr>
    `).join('');

    section = `
      <div class="container">
        <div class="header">
          <h2>${active.name} <small><code>${active.merchantID}</code></small></h2>
          <small>${active.running ? '⏳ Running...' : `<a href="/manual-trigger/${active.key}">Run now</a>`}</small>
        </div>
        <table>
          <thead>
            <tr>
              <th>Time (ET)</th>
              <th>Trigger</th>
              <th>Status</th>
              <th>Detail</th>
              <th>Transaction ID</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5" style="text-align:center;">Waiting for first transaction...</td></tr>'}</tbody>
        </table>
      </div>
    `;
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Niubiz Cron Monitor</title>
      <meta http-equiv="refresh" content="30">
      <style>
        body { font-family: -apple-system, sans-serif; padding: 40px; background: #f8f9fa; }
        .container { max-width: 900px; margin: 0 auto 30px; background: white; padding: 20px; border-radius: 0 8px 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .tabs { max-width: 940px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 4px; }
        .tab { padding: 10px 16px; background: #e9ecef; color: #555; text-decoration: none; border-radius: 8px 8px 0 0; display: flex; align-items: center; gap: 8px; }
        .tab:hover { background: #dee2e6; }
        .tab.active { background: white; color: #111; font-weight: bold; box-shadow: 0 -2px 6px rgba(0,0,0,0.06); }
        .badges { display: flex; gap: 3px; }
        .badge { font-size: 11px; font-weight: bold; color: white; padding: 1px 6px; border-radius: 10px; }
        .badge-success { background: #27ae60; }
        .badge-declined { background: #e67e22; }
        .badge-error { background: #c0392b; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f1f1f1; }
        .status-success { color: #27ae60; font-weight: bold; }
        .status-declined { color: #e67e22; font-weight: bold; }
        .status-error { color: #c0392b; font-weight: bold; }
        .header { display: flex; justify-content: space-between; align-items: center; }
        .page-header { max-width: 940px; margin: 0 auto 20px; display: flex; justify-content: space-between; align-items: center; }
      </style>
    </head>
    <body>
      <div class="page-header">
        <h1>Payment Activity Monitor</h1>
        <small>Cron "${CRON_SCHEDULE}" (ET) · ${payloads.length} payloads · Auto-refreshes every 30s</small>
      </div>
      ${active ? `<div class="tabs">${tabs}</div>${section}` : '<div class="container">No environments configured. Check credentials in .env.</div>'}
    </body>
    </html>
  `);
});

// Manual Trigger: all environments in parallel
app.get('/manual-trigger', async (req, res) => {
  res.json(await Promise.all(contexts.map(ctx => runContext(ctx, 'MANUAL'))));
});

// Manual Trigger: one environment (int, cert, release, uat)
app.get('/manual-trigger/:env', async (req, res) => {
  const ctx = contexts.find(c => c.key === req.params.env.toLowerCase());
  if (!ctx) return res.status(404).json({ error: `Unknown environment "${req.params.env}"`, available: contexts.map(c => c.key) });
  res.json(await runContext(ctx, 'MANUAL'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server monitoring active on port ${PORT} | cron "${CRON_SCHEDULE}" | ${payloads.length} payloads`);
  console.log(`🌐 Environments: ${contexts.map(c => `${c.name} (${c.merchantID})`).join(', ') || 'none'}`);
});
