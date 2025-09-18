console.log('🚀 Starting minimal test server...');

const express = require('express');
console.log('✅ Express loaded');

const app = express();
console.log('✅ App created');

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
console.log('✅ Health endpoint added');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

