// Vercel Serverless Function — Stripe Webhook Handler
// Receives subscription lifecycle events from Stripe
// Set STRIPE_WEBHOOK_SECRET in Vercel env vars. Optional: SUPABASE_URL + SUPABASE_SERVICE_KEY to sync subs

import Stripe from 'stripe';

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey) return res.status(500).json({ error: 'Stripe 未配置' });

  const stripe = Stripe(stripeKey);
  let event;

  // Verify webhook signature (only when secret is configured)
  if (webhookSecret) {
    const sig = req.headers['stripe-signature'];
    if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' });
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } else {
    // Dev mode — no signature verification
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    event = body;
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const plan = session.metadata?.plan || 'starter';
        const email = session.customer_details?.email;
        const stripeCustomerId = session.customer;
        console.log('✅ Checkout completed:', session.id, 'Plan:', plan, 'Email:', email);

        // Sync subscription to Supabase if configured
        const sb = await getSupabase();
        if (sb && email) {
          try {
            const limitMap = { starter: 50, creator: 200, enterprise: 999999 };
            const { data: user } = await sb.from('users').select('*').eq('email', email).single();
            if (user) {
              await sb.from('users').update({
                subscription_plan: plan,
                subscription_status: 'active',
                stripe_customer_id: stripeCustomerId,
                generations_limit: limitMap[plan] || 50,
                generations_used: 0,
              }).eq('id', user.id);
              console.log('✅ Subscription synced to Supabase for', email);
            }
          } catch (e) {
            console.error('Failed to sync subscription:', e.message);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log('🔄 Subscription updated:', subscription.id, 'Status:', subscription.status);
        const sb = await getSupabase();
        if (sb && subscription.metadata?.email) {
          await sb.from('users').update({ subscription_status: subscription.status }).eq('email', subscription.metadata.email);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('❌ Subscription canceled:', subscription.id);
        const sb = await getSupabase();
        if (sb) {
          // Try to find user by customer ID
          const { data: user } = await sb.from('users').select('*').eq('stripe_customer_id', subscription.customer).single();
          if (user) {
            await sb.from('users').update({
              subscription_status: 'canceled',
              generations_limit: 3, // Reset to free limit
            }).eq('id', user.id);
            console.log('✅ Subscription marked as canceled for user', user.email);
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        console.log('💰 Payment received:', invoice.amount_paid / 100, invoice.currency);
        // Reset monthly generation counter
        const sb = await getSupabase();
        if (sb && invoice.customer) {
          const { data: user } = await sb.from('users').select('*').eq('stripe_customer_id', invoice.customer).single();
          if (user) {
            await sb.from('users').update({ generations_used: 0 }).eq('id', user.id);
            console.log('✅ Generation counter reset for', user.email);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log('⚠️ Payment failed:', invoice.id);
        // TODO: Notify customer
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}
