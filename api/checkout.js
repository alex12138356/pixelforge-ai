// Vercel Serverless Function — Stripe Checkout
// Cost: free to start, 2.9% + $0.30 per transaction

import Stripe from 'stripe';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(500).json({ error: 'Stripe 未配置' });

    const stripe = Stripe(stripeKey);
    const { plan } = req.body || {};

    // Pricing — edit these to your needs
    const plans = {
      starter:   { name: 'Starter',   price: 1900, id: 'price_starter' },
      creator:   { name: 'Creator Pro', price: 4900, id: 'price_creator' },
      enterprise: { name: 'Enterprise', price: 14900, id: 'price_enterprise' }
    };

    const selected = plans[plan];
    if (!selected) return res.status(400).json({ error: '无效的套餐' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: selected.name },
          unit_amount: selected.price,
          recurring: { interval: 'month' }
        },
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${req.headers.origin || 'https://your-site.vercel.app'}/?success=true`,
      cancel_url: `${req.headers.origin || 'https://your-site.vercel.app'}/?canceled=true`
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: '创建支付会话失败' });
  }
}
