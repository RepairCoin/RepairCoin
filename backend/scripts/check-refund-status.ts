import Stripe from 'stripe';
import * as dotenv from 'dotenv';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any });

async function check() {
  // The order from the user's test - $59 S Tripe Hair Cut
  const paymentIntentId = 'pi_3Spk30L8hwPnzzXk0Lg3m2cJ';
  console.log('Checking PaymentIntent:', paymentIntentId);

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  console.log('Status:', pi.status);
  console.log('Amount:', pi.amount / 100);

  const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId } as any);
  console.log('Number of refunds:', refunds.data.length);
  if (refunds.data.length > 0) {
    refunds.data.forEach(r => console.log('  Refund:', r.id, '$' + r.amount/100, r.status));
  } else {
    console.log('NO REFUNDS - The shop cancel did NOT process the refund!');
  }
}

check().catch(console.error);
