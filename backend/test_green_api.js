// backend/test_green_api.js
const axios = require('axios');

const GREEN_API_URL = process.env.GREEN_API_URL;
const ID_INSTANCE = process.env.GREEN_API_ID_INSTANCE;
const TOKEN = process.env.GREEN_API_TOKEN;

console.log('🔍 TESTING GREEN API INTEGRATION');
console.log('='.repeat(50));
console.log('GREEN_API_URL:', GREEN_API_URL);
console.log('ID_INSTANCE:', ID_INSTANCE);
console.log('TOKEN:', TOKEN ? 'SET' : 'NOT SET');

async function testGreenAPI() {
  try {
    if (!GREEN_API_URL || !ID_INSTANCE || !TOKEN) {
      console.log('❌ Green API credentials not configured');
      return;
    }

    // Test 1: Check instance status
    console.log('\n📡 Testing instance status...');
    try {
      const statusResponse = await axios.get(`${GREEN_API_URL}/waInstance${ID_INSTANCE}/getStatusInstance/${TOKEN}`);
      console.log('✅ Instance status:', statusResponse.data);
    } catch (error) {
      console.log('❌ Instance status check failed:', error.response?.data || error.message);
    }

    // Test 2: Send test message
    console.log('\n📱 Testing message send...');
    try {
      const testPhone = '+996555123456'; // Test phone number
      const testMessage = 'Test message from University Ticketing System';
      
      const messageResponse = await axios.post(`${GREEN_API_URL}/waInstance${ID_INSTANCE}/sendMessage/${TOKEN}`, {
        chatId: testPhone + '@c.us',
        message: testMessage
      });
      
      console.log('✅ Message sent successfully:', messageResponse.data);
    } catch (error) {
      console.log('❌ Message send failed:', error.response?.data || error.message);
      console.log('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    }

    // Test 3: Check settings
    console.log('\n⚙️ Testing settings...');
    try {
      const settingsResponse = await axios.get(`${GREEN_API_URL}/waInstance${ID_INSTANCE}/getSettings/${TOKEN}`);
      console.log('✅ Settings:', settingsResponse.data);
    } catch (error) {
      console.log('❌ Settings check failed:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Green API test failed:', error.message);
  }
}

testGreenAPI();
