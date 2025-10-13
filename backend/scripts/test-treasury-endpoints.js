const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:4000';
const ADMIN_WALLET = process.env.ADMIN_WALLET || '0x5D47E7bfD643A1C388E25C5Fb977A92926c9E0dB';

async function getAdminToken() {
    try {
        const response = await axios.post(`${BASE_URL}/api/auth/admin`, {
            walletAddress: ADMIN_WALLET
        });
        return response.data.token;
    } catch (error) {
        console.error('Failed to get admin token:', error.response?.data || error.message);
        throw error;
    }
}

async function testTreasuryEndpoints(token) {
    const endpoints = [
        {
            name: 'Get Treasury Stats',
            method: 'GET',
            path: '/api/admin/treasury'
        },
        {
            name: 'Get RCG Metrics',
            method: 'GET',
            path: '/api/admin/treasury/rcg'
        },
        {
            name: 'Update Treasury',
            method: 'POST',
            path: '/api/admin/treasury/update',
            data: {}
        }
    ];

    for (const endpoint of endpoints) {
        console.log(`\n\n=== Testing: ${endpoint.name} ===`);
        console.log(`${endpoint.method} ${BASE_URL}${endpoint.path}`);
        
        try {
            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };

            let response;
            if (endpoint.method === 'GET') {
                response = await axios.get(`${BASE_URL}${endpoint.path}`, config);
            } else {
                response = await axios.post(`${BASE_URL}${endpoint.path}`, endpoint.data || {}, config);
            }

            console.log('✅ Success:', response.status);
            console.log('Response:', JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.error('❌ Error:', error.response?.status || error.code);
            console.error('Details:', error.response?.data || error.message);
            
            // Log SQL errors if present
            if (error.response?.data?.details) {
                console.error('SQL Error:', error.response.data.details);
            }
        }
    }
}

async function main() {
    try {
        console.log('🔐 Getting admin token...');
        const token = await getAdminToken();
        console.log('✅ Got admin token');
        
        await testTreasuryEndpoints(token);
    } catch (error) {
        console.error('Failed to run tests:', error.message);
        process.exit(1);
    }
}

main();