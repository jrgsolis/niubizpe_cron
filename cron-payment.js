const { runAllPayloads, payloadLabel, payloads } = require('./paymentRunner');
const { buildContexts } = require('./environments');
require('dotenv').config();

// One-off run of every payload in payloads.json
// Usage: node cron-payment.js [int|cert|release|uat|all]   (default: all)
async function runScheduledPayment() {
  const target = (process.argv[2] || 'all').toLowerCase();
  const contexts = buildContexts().filter(c => target === 'all' || c.key === target);
  if (contexts.length === 0) {
    console.error(`💥 No configured environment matches "${target}"`);
    process.exit(1);
  }

  try {
    for (const ctx of contexts) {
      console.log(`[${new Date().toISOString()}] [${ctx.name}] Manual Execution Started (${payloads.length} payloads)...`);
      await runAllPayloads(ctx, (p, i, result, err) => {
        const label = `[${ctx.name}] ${payloadLabel(p, i)}`;
        if (err) {
          console.error(`💥 ${label} Failure:`, err.message);
        } else if (result.status === 'AUTHORIZED') {
          console.log(`✅ ${label} Success! Transaction ID: ${result.id}`);
        } else {
          console.error(`❌ ${label} Refused:`, JSON.stringify(result, null, 2));
        }
      });
    }
  } finally {
    // IMPORTANT: Since this is a standalone script, we must exit.
    // If this were server.js, we would NOT call process.exit.
    process.exit(0);
  }
}

runScheduledPayment();
