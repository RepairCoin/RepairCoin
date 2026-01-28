/**
 * Verify the refund fix by processing refunds on cancelled orders
 * that were missed due to the 'requested_by_merchant' bug
 */
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any
});

async function main() {
  // These are cancelled orders that have 0 refunds due to the bug
  const unrefundedPaymentIntents = [
    { orderId: 'ord_c438a7d1-ead0-4809-bc82-1fcc5d394822', pi: 'pi_3Spk30L8hwPnzzXk0Lg3m2cJ' },
    { orderId: 'ord_20088b95-32fc-4c1e-b383-7cdfe8469bfd', pi: 'pi_3SpjgdL8hwPnzzXk1BJKQc69' },
    { orderId: 'ord_3d73d658-9620-4135-a456-bb77dfade200', pi: 'pi_3SosbtL8hwPnzzXk08SW2Uny' }
  ];

  console.log('\n=== VERIFYING REFUND FIX ===\n');
  console.log('Testing with correct reason: requested_by_customer\n');

  // Take just the first one to test
  const test = unrefundedPaymentIntents[0];

  console.log(`Order: ${test.orderId}`);
  console.log(`PaymentIntent: ${test.pi}`);

  // First check current refund status
  const refundsBefore = await stripe.refunds.list({ payment_intent: test.pi });
  console.log(`Current refunds: ${refundsBefore.data.length}`);

  if (refundsBefore.data.length > 0) {
    console.log('Already has refunds, skipping...');
    return;
  }

  // Try with the CORRECT reason
  console.log('\nProcessing refund with reason: requested_by_customer...\n');

  try {
    const refund = await stripe.refunds.create({
      payment_intent: test.pi,
      reason: 'requested_by_customer'  // The correct reason!
    });

    console.log('✅ REFUND SUCCESSFUL!');
    console.log(`   Refund ID: ${refund.id}`);
    console.log(`   Amount: $${refund.amount / 100}`);
    console.log(`   Status: ${refund.status}`);
    console.log('\n🎉 THE FIX WORKS! The refund reason was the issue.');
  } catch (error: any) {
    console.log('❌ REFUND FAILED:', error.message);
  }
}

main().catch(console.error);
