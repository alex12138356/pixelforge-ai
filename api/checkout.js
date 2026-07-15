// Vercel Serverless Function — Stripe Checkout
// Cost: free to start, 2.9% + $0.30 per transaction
//
// Mode 1 (default): Creates products on the fly via price_data — no setup needed
// Mode 2 (advanced): Use pre-created Stripe Price IDs via env vars for production

import Stripe from 'stripe';

// Price definitions — edit amounts here
const PLANS = {
  starter:   { name: 'Starter',     price: 1900, desc: '50 次 AI 生成/月' },
  creator:   { name: 'Creator Pro', price: 4900, desc: '200 次 AI 生成/月' },
  enterprise:{ name: 'Enterprise',  price: 14900, desc: '无限 AI 生成/月' },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(500).json({ error: 'Stripe 未配置，请在 Vercel 环境变量中设置 STRIPE_SECRET_KEY' });

    const stripe = Stripe(stripeKey);
    const { plan, email } = req.body || {};
    const selected = PLANS[plan];
    if (!selected) return res.status(400).json({ error: '无效的套餐' });

    // Check for pre-created Stripe Price ID (production mode)
    const priceIdKey = `PRICE_ID_${plan.toUpperCase()}`;
    const priceId = process.env[priceIdKey];

    const lineItems = priceId
      ? [{ price: priceId, quantity: 1 }]
      : [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: selected.name,
              description: selected.desc,
            },
            unit_amount: selected.price,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }];

    const origin = req.headers.origin || 'https://pixelforge-ai.vercel.app';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      ...(email && { customer_email: email }),
      success_url: `${origin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=true`,
      metadata: { plan },
    });

    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message || '创建支付会话失败' });
  }
}
