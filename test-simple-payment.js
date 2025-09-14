// Simple test for payment confirmation
const https = require('https');

async function testPayment() {
  const bookingId = 'BKMFJVPILU'; // The booking we just created
  
  const data = JSON.stringify({
    bookingId: bookingId,
    paymentMethod: 'card',
    amount: 1000
  });

  const options = {
    hostname: 'upbeat-compassion-production.up.railway.app',
    port: 443,
    path: '/api/confirm-payment',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = https.request(options, (res) => {
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', res.headers);
    
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });
    
    res.on('end', () => {
      console.log('Response Body:', body);
      try {
        const jsonResponse = JSON.parse(body);
        console.log('Parsed Response:', JSON.stringify(jsonResponse, null, 2));
      } catch (e) {
        console.log('Could not parse JSON response');
      }
    });
  });

  req.on('error', (e) => {
    console.error('Request error:', e);
  });

  req.write(data);
  req.end();
}

testPayment();
