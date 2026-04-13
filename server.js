const express = require('express');
const cron = require('node-cron');
const cybersource = require('./cybersourceService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. LOGGING STORAGE ---
// This stores logs in memory. Note: They reset if Railway restarts.
let paymentLogs = [];

function addLog(type, status, detail, transactionId = 'N/A') {
  const entry = {
    timestamp: new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
    type: type, // 'AUTO' or 'MANUAL'
    status: status,
    detail: detail,
    transactionId: transactionId
  };
  paymentLogs.unshift(entry); // Add new logs to the top
  if (paymentLogs.length > 50) paymentLogs.pop(); // Keep only the last 50
}

const customerData = {
  firstName: "John",
  lastName: "Doe",
  address1: "1 Market St",
  locality: "San Francisco",
  administrativeArea: "CA",
  postalCode: "94105",
  country: "US",
  email: "test@cybs.com",
  phone: "4158880000"
};

const cardData = {
  number: process.env.TEST_CARD_NUMBER || "4111111111111111",
  expirationMonth: "12",
  expirationYear: "2031"
};

// --- 2. 15-MINUTE SCHEDULED TASK ---
// '*/15 * * * *' triggers every 15 minutes (0, 15, 30, 45)
cron.schedule('*/15 * * * *', async () => {
  console.log(`[${new Date().toISOString()}] 🕒 AUTO-TRIGGER: Starting 15-minute payment...`);
  
  try {
    const result = await cybersource.processPayment("10.00", "PEN", customerData, cardData);
    const isAuth = result.status === 'AUTHORIZED';
    
    addLog('AUTO', isAuth ? 'SUCCESS' : 'DECLINED', isAuth ? '15-Min Payment' : result.status, result.id || 'N/A');
    console.log(isAuth ? `✅ Success: ${result.id}` : `⚠️ Declined: ${result.status}`);
  } catch (err) {
    addLog('AUTO', 'ERROR', err.message);
    console.error('💥 Cron Error:', err.message);
  }
}, {
  scheduled: true,
  timezone: "America/New_York"
});

// --- 3. WEB ROUTES ---

// Dashboard View
app.get('/', (req, res) => {
  const rows = paymentLogs.map(log => `
    <tr>
      <td>${log.timestamp}</td>
      <td><strong>${log.type}</strong></td>
      <td><span class="status-${log.status.toLowerCase()}">${log.status}</span></td>
      <td>${log.detail}</td>
      <td><code>${log.transactionId}</code></td>
    </tr>
  `).join('');

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Niubiz Cron Monitor</title>
      <meta http-equiv="refresh" content="30">
      <style>
        body { font-family: -apple-system, sans-serif; padding: 40px; background: #f8f9fa; }
        .container { max-width: 900px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f1f1f1; }
        .status-success { color: #27ae60; font-weight: bold; }
        .status-declined { color: #e67e22; font-weight: bold; }
        .status-error { color: #c0392b; font-weight: bold; }
        .header { display: flex; justify-content: space-between; align-items: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Payment Activity Monitor</h2>
          <small>Auto-refreshes every 30s</small>
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
    </body>
    </html>
  `);
});

// Manual Trigger
app.post('/manual-trigger', async (req, res) => {
  console.log(`[${new Date().toISOString()}] ⚡ MANUAL-TRIGGER: Processing...`);
  try {
    const result = await cybersource.processPayment("10.00", "PEN", customerData, cardData);
    const isAuth = result.status === 'AUTHORIZED';
    
    addLog('MANUAL', isAuth ? 'SUCCESS' : 'DECLINED', isAuth ? 'Manual Test' : result.status, result.id || 'N/A');
    res.json(result);
  } catch (err) {
    addLog('MANUAL', 'ERROR', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server monitoring active on port ${PORT}`);
});