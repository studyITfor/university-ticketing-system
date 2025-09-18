console.log('🚀 Starting server initialization...');

try {
    const express = require('express');
    console.log('✅ Express loaded');
} catch (e) {
    console.error('❌ Express failed:', e.message);
    process.exit(1);
}

try {
    const { createServer } = require('http');
    console.log('✅ HTTP server loaded');
} catch (e) {
    console.error('❌ HTTP server failed:', e.message);
    process.exit(1);
}

try {
    const { Server } = require('socket.io');
    console.log('✅ Socket.IO loaded');
} catch (e) {
    console.error('❌ Socket.IO failed:', e.message);
    process.exit(1);
}

try {
    const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
    console.log('✅ PDF-lib loaded');
} catch (e) {
    console.error('❌ PDF-lib failed:', e.message);
    process.exit(1);
}

try {
    const fontkit = require('@pdf-lib/fontkit');
    console.log('✅ Fontkit loaded');
} catch (e) {
    console.error('❌ Fontkit failed:', e.message);
    process.exit(1);
}

try {
    const QRCode = require('qrcode');
    console.log('✅ QRCode loaded');
} catch (e) {
    console.error('❌ QRCode failed:', e.message);
    process.exit(1);
}

try {
    const fs = require('fs-extra');
    console.log('✅ fs-extra loaded');
} catch (e) {
    console.error('❌ fs-extra failed:', e.message);
    process.exit(1);
}

try {
    const path = require('path');
    console.log('✅ path loaded');
} catch (e) {
    console.error('❌ path failed:', e.message);
    process.exit(1);
}

try {
    const axios = require('axios');
    console.log('✅ axios loaded');
} catch (e) {
    console.error('❌ axios failed:', e.message);
    process.exit(1);
}

try {
    const cors = require('cors');
    console.log('✅ cors loaded');
} catch (e) {
    console.error('❌ cors failed:', e.message);
    process.exit(1);
}

try {
    const { Blob } = require('buffer');
    console.log('✅ Blob loaded');
} catch (e) {
    console.error('❌ Blob failed:', e.message);
    process.exit(1);
}

try {
    const { FormData } = require('undici');
    console.log('✅ FormData loaded');
} catch (e) {
    console.error('❌ FormData failed:', e.message);
    process.exit(1);
}

try {
    const config = require('./config');
    console.log('✅ config loaded');
} catch (e) {
    console.error('❌ config failed:', e.message);
    process.exit(1);
}

try {
    const SecureTicketSystem = require('./secure-ticket-system');
    console.log('✅ SecureTicketSystem loaded');
} catch (e) {
    console.error('❌ SecureTicketSystem failed:', e.message);
    process.exit(1);
}

try {
    const db = require('./database');
    console.log('✅ database loaded');
} catch (e) {
    console.error('❌ database failed:', e.message);
    process.exit(1);
}

console.log('✅ All modules loaded successfully!');
