const cybersource = require('./cybersourceService');
require('dotenv').config();

async function runScheduledPayment() {
  console.log(`[${new Date().toISOString()}] Manual Execution Started...`);

  // 1. Define the dynamic data
  const amount = "10.00"; 
  const currency = "PEN";

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

  // 2. Execute with the new 4-argument signature
  try {
    const result = await cybersource.processPayment(
      amount, 
      currency, 
      customerData, 
      cardData
    );
    
    if (result.status === 'AUTHORIZED') {
      console.log(`✅ Success! Transaction ID: ${result.id}`);
    } else {
      console.error('❌ Payment Refused:', JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error('💥 Critical Failure:', err.message);
  } finally {
    // IMPORTANT: Since this is a standalone script, we must exit.
    // If this were server.js, we would NOT call process.exit.
    process.exit(0);
  }
}

runScheduledPayment();