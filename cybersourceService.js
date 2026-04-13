const cybersourceRestApi = require('cybersource-rest-client');
require('dotenv').config();

class CybersourceService {
  constructor() {
    this.config = {
      authenticationType: 'http_signature',
      runEnvironment: 'apitest.cybersource.com', // or 'api.cybersource.com' for prod
      merchantID: process.env.CYBS_MERCHANT_ID.trim(),
      merchantKeyId: process.env.CYBS_KEY_ID.trim(),
      merchantsecretKey: process.env.CYBS_SECRET_KEY.trim(),
      logConfiguration: {
        enableLog: false
      }
    };
  }

  async processPayment(amount, currency, customerData, cardData) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    const clientReferenceInformation = new cybersourceRestApi.Ptsv2paymentsClientReferenceInformation();
    clientReferenceInformation.code = `SDK_PAY_${timestamp}`;

    const processingInformation = new cybersourceRestApi.Ptsv2paymentsProcessingInformation();
    processingInformation.capture = true;

    const amountDetails = new cybersourceRestApi.Ptsv2paymentsOrderInformationAmountDetails();
    amountDetails.totalAmount = amount.toString();
    amountDetails.currency = currency;

    const billTo = new cybersourceRestApi.Ptsv2paymentsOrderInformationBillTo();
    billTo.firstName = customerData.firstName;
    billTo.lastName = customerData.lastName;
    billTo.address1 = customerData.address1;
    billTo.locality = customerData.locality;
    billTo.administrativeArea = customerData.administrativeArea;
    billTo.postalCode = customerData.postalCode;
    billTo.country = customerData.country;
    billTo.email = customerData.email;
    billTo.phoneNumber = customerData.phone.replace(/\D/g, '');

    const orderInformation = new cybersourceRestApi.Ptsv2paymentsOrderInformation();
    orderInformation.amountDetails = amountDetails;
    orderInformation.billTo = billTo;

    const card = new cybersourceRestApi.Ptsv2paymentsPaymentInformationCard();
    card.number = cardData.number.replace(/\s/g, '');
    card.expirationMonth = cardData.expirationMonth.toString().padStart(2, '0');
    card.expirationYear = cardData.expirationYear.toString();

    const paymentInformation = new cybersourceRestApi.Ptsv2paymentsPaymentInformation();
    paymentInformation.card = card;

    const requestObj = new cybersourceRestApi.CreatePaymentRequest();
    requestObj.clientReferenceInformation = clientReferenceInformation;
    requestObj.processingInformation = processingInformation;
    requestObj.orderInformation = orderInformation;
    requestObj.paymentInformation = paymentInformation;

    const instance = new cybersourceRestApi.PaymentsApi(this.config);

    return new Promise((resolve, reject) => {
      console.log("--- SDK: SENDING ENCRYPTED PAYLOAD ---");
      instance.createPayment(requestObj, (error, data, response) => {
        if (error) {
          console.error("❌ SDK ERROR:", JSON.stringify(error, null, 2));
          // Usually error contains the response body in error.response.text
          resolve(error.response ? JSON.parse(error.response.text) : error);
        } else {
          console.log("✅ SDK SUCCESS!");
          resolve(data);
        }
      });
    });
  }
}

module.exports = new CybersourceService();