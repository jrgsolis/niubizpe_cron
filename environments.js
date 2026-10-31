const CybersourceService = require('./cybersourceService');
require('dotenv').config();

// Each environment reads its credentials from .env using its prefix: <PREFIX>_CYBS_MERCHANT_ID, etc.
const ENVIRONMENTS = [
  { key: 'int', name: 'Integration', prefix: 'INT' },
  { key: 'cert', name: 'Cert', prefix: 'CERT' },
  { key: 'release', name: 'Release', prefix: 'RELEASE' },
  { key: 'uat', name: 'UAT', prefix: 'UAT' }
];

function envVar(prefix, name) {
  return (process.env[`${prefix}_${name}`] || '').trim();
}

// Builds one context per environment with complete credentials; others are skipped with a warning
function buildContexts() {
  const contexts = [];
  for (const env of ENVIRONMENTS) {
    const merchantID = envVar(env.prefix, 'CYBS_MERCHANT_ID');
    const merchantKeyId = envVar(env.prefix, 'CYBS_KEY_ID');
    const merchantsecretKey = envVar(env.prefix, 'CYBS_SECRET_KEY');
    if (!merchantID || !merchantKeyId || !merchantsecretKey) {
      console.warn(`⚠️ Skipping ${env.name}: missing ${env.prefix}_CYBS_* credentials in .env`);
      continue;
    }
    contexts.push({
      ...env,
      merchantID,
      service: new CybersourceService({
        runEnvironment: envVar(env.prefix, 'CYBS_HOST') || 'apitest.cybersource.com',
        merchantID,
        merchantKeyId,
        merchantsecretKey
      }),
      // Per-env card override, falling back to the shared card numbers
      cards: {
        "001": envVar(env.prefix, 'VISA_CARD_NUMBER') || (process.env.VISA_CARD_NUMBER || '').trim(),
        "002": envVar(env.prefix, 'MASTERCARD_CARD_NUMBER') || (process.env.MASTERCARD_CARD_NUMBER || '').trim()
      },
      logs: []
    });
  }
  return contexts;
}

module.exports = { ENVIRONMENTS, buildContexts };
