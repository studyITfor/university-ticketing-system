// Configuration file for the University Ticketing System
module.exports = {
    // Green API Configuration for WhatsApp - Update with your credentials
    whatsapp: {
        apiUrl: 'https://7105.api.greenapi.com',
        id: '7105317460', // Replace with your Green API ID
        token: '76de4f547a564df4a3092b41aeacfd7ad0e848b3506d42a1b9' // Replace with your Green API Token
    },

    // Server Configuration
    server: {
        port: process.env.PORT || 3000
    },

    // Event Information
    event: {
        name: 'GOLDENMIDDLE',
        organization: 'КГМА',
        date: '26 октября 2025',
        time: '18:00',
        venue: 'Асман',
        price: 5500
    }
};
