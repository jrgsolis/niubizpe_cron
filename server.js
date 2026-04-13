const express = require('express');
const cron = require('node-cron');
const cybersource = require('./cybersourceService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Data Configuration
// In production, you might pull these from a database or environment variables
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

// 2. Hourly Scheduled Task
// '0 * * * *' triggers at the start of every hour
cron.schedule('0 * * * *', async () => {
  console.log(`[${new Date().toISOString()}] 🕒 AUTO-TRIGGER: Starting hourly payment...`);
  
  try {
    const result = await cybersource.processPayment("10.00", "PEN", customerData, cardData);
    
    if (result.status === 'AUTHORIZED') {
      console.log(`✅ Hourly Success: Transaction ID ${result.id}`);
    } else {
      console.error(`⚠️ Hourly Declined: Status ${result.status}`);
    }
  } catch (err) {
    console.error('💥 Hourly Cron Error:', err.message);
  }
}, {
  scheduled: true,
  timezone: "America/New_York" // Set to your local time (Doral/Eastern)
});

// 3. Web Routes
app.get('/', (req, res) => {
  res.send('Cybersource Hourly Worker is Active.');
});

// Manual trigger for testing: curl -X POST http://localhost:3000/manual-trigger
app.post('/manual-trigger', async (req, res) => {
  console.log(`[${new Date().toISOString()}] ⚡ MANUAL-TRIGGER: Processing request...`);
  
  try {
    const result = await cybersource.processPayment("10.00", "PEN", customerData, cardData);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server active on port ${PORT}`);
  console.log(`📅 Hourly schedule initialized (Top of the hour)`);
});