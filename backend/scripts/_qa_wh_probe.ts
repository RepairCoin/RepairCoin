// Separates "bad signature" from "handler threw". An unhandled event type falls to the switch's
// default and returns success — so a 200 here means the signature is fine and the fault is downstream.
import * as dotenv from 'dotenv';
import * as path from 'path';
import Stripe from 'stripe';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

(async () => {
  const API = process.env.QA_API_BASE || 'https://api-staging.repaircoin.ai';
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' as any });
  const secret = process.env.STRIPE_WEBHOOK_SECRET as string;

  const post = async (label: string, payload: string, sig: string) => {
    const r = await fetch(`${API}/api/shops/webhooks/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': sig },
      body: payload,
    });
    console.log(`  ${String(r.status).padEnd(4)} ${label}  ${(await r.text()).slice(0, 110)}`);
  };

  const benign = JSON.stringify({
    id: `evt_probe_${Date.now().toString(36)}`, object: 'event',
    type: 'invoice.upcoming', created: Math.floor(Date.now() / 1000),
    data: { object: { id: 'in_probe', object: 'invoice' } },
  });

  console.log('\nsigned with our secret, event type nobody handles:');
  await post('valid signature', benign, stripe.webhooks.generateTestHeaderString({ payload: benign, secret }));

  console.log('\ndeliberately wrong secret, for contrast:');
  await post('bad signature', benign, stripe.webhooks.generateTestHeaderString({ payload: benign, secret: 'whsec_definitely_wrong' }));
})();
