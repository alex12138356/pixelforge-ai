// Vercel Serverless Function — PayJS 扫码支付
// 用户点击购买 → 后端生成付款二维码 → 用户扫码支付
//
// 环境变量：
//   PAYJS_MCHID  — 商户号 (在 payjs.cn 后台获取)
//   PAYJS_KEY    — 商户密钥
//
// 未配置时自动进入开发模式（显示模拟二维码）

import { createPayJSOrder, queryPayJSOrder } from './_payjs.js';

// 价格定义 (人民币 元)
const PLANS = {
  starter:   { name: '基础版',  priceCN: 19.90, fee: 1990, desc: '50 次 AI 生成/月' },
  creator:   { name: '专业版',  priceCN: 49.90, fee: 4990, desc: '200 次 AI 生成/月' },
  enterprise:{ name: '企业版',  priceCN: 149.90, fee: 14990, desc: '无限 AI 生成/月' },
};

function generateOrderId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PF${ts}${rand}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { plan } = req.body || {};
    const selected = PLANS[plan];
    if (!selected) return res.status(400).json({ error: '无效的套餐' });

    const outTradeNo = generateOrderId();
    const body = `PixelForge AI - ${selected.name}套餐`;

    // 调用 PayJS API 生成二维码
    const result = await createPayJSOrder({
      totalFee: selected.fee,
      outTradeNo,
      body,
      notifyUrl: process.env.PAYJS_NOTIFY_URL || `${req.headers.origin || 'https://pixelforge-ai.vercel.app'}/api/check-order`,
    });

    res.status(200).json({
      qrCode: result.qrCode,
      payjsOrderId: result.payjsOrderId,
      outTradeNo: result.outTradeNo,
      plan,
      planName: selected.name,
      totalAmount: selected.priceCN,
      isDevMode: result.isDevMode || false,
      devPayUrl: result.devPayUrl || null,
      pollUrl: `/api/check-order?trade_no=${result.outTradeNo}`,
    });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message || '创建支付订单失败' });
  }
}

export { PLANS };
