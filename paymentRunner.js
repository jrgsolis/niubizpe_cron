const payloads = require('./payloads.json');

const CARD_BRANDS = { "001": "VISA", "002": "MASTERCARD" };

// Deep-copies the payload (the SDK mutates request bodies) and injects the context's card number
function buildRequest(payload, cards) {
  const body = JSON.parse(JSON.stringify(payload));
  const card = body.paymentInformation?.card;
  const brand = card && CARD_BRANDS[card.type];
  if (!brand) throw new Error(`Unknown card type "${card?.type}" (use "001" Visa or "002" Mastercard)`);
  if (!cards[card.type]) throw new Error(`Missing ${brand} card number in .env`);
  card.number = cards[card.type].replace(/\s/g, '');
  return body;
}

function payloadLabel(payload, index) {
  return payload.clientReferenceInformation?.code || `#${index + 1}`;
}

// Runs every payload sequentially against one environment context;
// onResult(payload, index, result|null, error|null)
async function runAllPayloads(context, onResult) {
  for (let i = 0; i < payloads.length; i++) {
    const p = payloads[i];
    try {
      const result = await context.service.sendPayment(buildRequest(p, context.cards));
      onResult(p, i, result, null);
    } catch (err) {
      onResult(p, i, null, err);
    }
  }
}

module.exports = { runAllPayloads, payloadLabel, payloads };
