#!/usr/bin/env ts-node

import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

async function debugShopStatus() {
  const walletAddress = '0x2dE1BdF96Bb5d861dEf85D5B8F2997792cB21Ece';
  console.log(`🔍 Debugging shop status for: ${walletAddress}\n`);

  // For now, let's check via the health endpoint what we can access
  const healthCheck = await fetch('https://repaircoin-staging-s7743.ondigitalocean.app/api/health');
  const healthData = await healthCheck.json();
  
  console.log('🏥 Staging API Health:', healthData.data?.status);
  
  // Try to get shop info via the shop API endpoint
  try {
    const shopResponse = await fetch(`https://repaircoin-staging-s7743.ondigitalocean.app/api/shop`, {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify({
        walletAddress: walletAddress
      })
    });
    
    if (shopResponse.ok) {
      const shopData = await shopResponse.json();
      console.log('🏪 Shop Data from API:');
      console.log(JSON.stringify(shopData, null, 2));
    } else {
      console.log('❌ Shop API Error:', shopResponse.status, shopResponse.statusText);
    }
  } catch (error) {
    console.error('❌ Error calling shop API:', error);
  }
}

// Run the debug
debugShopStatus().catch(console.error);