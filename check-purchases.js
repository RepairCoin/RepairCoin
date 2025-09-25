const https = require('https');

// Configuration
const API_URL = 'https://repaircoin-staging-s7743.ondigitalocean.app';
const SHOP_ID = 'zwift-tech';

// Simple HTTPS request helper
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = `${API_URL}${path}`;
    console.log(`\nFetching: ${url}`);
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function checkPurchases() {
  try {
    // 1. Check API health
    console.log('=== Checking API Health ===');
    const health = await makeRequest('/api/health');
    console.log('API Status:', health.status);
    
    // 2. Try to get purchase status without auth (will show what we need)
    console.log('\n=== Attempting to check purchases (will show auth requirement) ===');
    const purchases = await makeRequest(`/api/admin/debug/purchase-status/${SHOP_ID}`);
    console.log('Response:', JSON.stringify(purchases, null, 2));
    
    // 3. Try pending mints endpoint
    console.log('\n=== Attempting to check pending mints ===');
    const pendingMints = await makeRequest(`/api/admin/debug/pending-mints/${SHOP_ID}`);
    console.log('Response:', JSON.stringify(pendingMints, null, 2));
    
    // 4. Check all shops purchases
    console.log('\n=== Checking all shops with purchases ===');
    const allShops = await makeRequest('/api/admin/debug/all-shops-purchases');
    console.log('Response:', JSON.stringify(allShops, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

console.log('RepairCoin Purchase Checker');
console.log('===========================');
console.log(`Shop ID: ${SHOP_ID}`);
console.log(`API URL: ${API_URL}`);

checkPurchases();

console.log('\n\nNOTE: These requests will fail with 401 Unauthorized.');
console.log('This shows the endpoints are working but need authentication.');
console.log('\nTo get proper data, you need to:');
console.log('1. Use the frontend when it\'s deployed');
console.log('2. Or manually check the database');
console.log('3. Or add authentication to this script');