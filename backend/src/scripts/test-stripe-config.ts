import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

console.log('=== Stripe Configuration Test ===\n');

// Check required environment variables
const requiredVars = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_MONTHLY_PRICE_ID: process.env.STRIPE_MONTHLY_PRICE_ID,
};

let allConfigured = true;

Object.entries(requiredVars).forEach(([key, value]) => {
  if (!value) {
    console.log(`❌ ${key}: MISSING`);
    allConfigured = false;
  } else {
    const displayValue = key === 'STRIPE_SECRET_KEY' 
      ? `${value.substring(0, 7)}...${value.slice(-4)}`
      : value.substring(0, 20) + (value.length > 20 ? '...' : '');
    console.log(`✅ ${key}: ${displayValue}`);
  }
});

console.log('\n=== Additional Configuration ===');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);

if (!allConfigured) {
  console.log('\n⚠️  Some required Stripe configuration is missing!');
  console.log('Please ensure all required environment variables are set in your .env file.');
  console.log('\nExample configuration:');
  console.log('STRIPE_SECRET_KEY=sk_test_...');
  console.log('STRIPE_WEBHOOK_SECRET=whsec_...');
  console.log('STRIPE_MONTHLY_PRICE_ID=price_...');
} else {
  console.log('\n✅ All required Stripe configuration is present!');
  
  // Try to initialize Stripe
  try {
    const Stripe = require('stripe').default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    });
    
    console.log('✅ Stripe client initialized successfully!');
    
    // Try to retrieve the price to verify the configuration
    if (process.env.STRIPE_MONTHLY_PRICE_ID) {
      stripe.prices.retrieve(process.env.STRIPE_MONTHLY_PRICE_ID)
        .then((price: any) => {
          console.log(`✅ Price verified: ${price.unit_amount / 100} ${price.currency.toUpperCase()} per ${price.recurring?.interval || 'one-time'}`);
        })
        .catch((error: any) => {
          console.log(`❌ Failed to retrieve price: ${error.message}`);
          if (error.message.includes('No such price')) {
            console.log('   Make sure STRIPE_MONTHLY_PRICE_ID is correct for your Stripe account.');
          }
        });
    }
  } catch (error) {
    console.log(`❌ Failed to initialize Stripe: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

console.log('\n=== Test Complete ===');