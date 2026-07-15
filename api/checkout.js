// Vercel Serverless Function — 支付宝当面付
// 用户点击购买 → 后端生成付款二维码 → 用户支付宝扫码支付
//
// 环境变量 (Vercel)：
//   ALIPAY_APP_ID       — 必填，支付宝应用 ID
//   ALIPAY_PRIVATE_KEY  — 必填，商户 RSA2 私钥
//   ALIPAY_PUBLIC_KEY   — 建议配置，用于验证回调签名
//   ALIPAY_NOTIFY_URL   — 可选，回调通知 URL
//
// 未配置时自动进入开发模式（显示模拟二维码）

import { createAlipayQRCode, queryAlipayOrder } from './_alipay.js';

// 价格定义 (人民币 元)
const PLANS = {
  starter:   { name: '基础版',  price: 19.90, unit: '元', desc: '50 次 AI 生成/月', priceCN: 19.90 },
  creator:   { name: '专业版',  price: 49.90, unit: '元', desc: '200 次 AI 生成/月', priceCN: 49.90 },
  enterprise:{ name: '企业版',  price: 149.90, unit: '元', desc: '无限 AI 生成/月', priceCN: 149.90 },
};

// 生成唯一订单号
function generateOrderId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PF${ts}${rand}`;
}

export default async function handler(req, res) {
  // CORS
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
    const subject = `PixelForge AI - ${selected.name}套餐`;

    // 调用支付宝 API 生成二维码
    const result = await createAlipayQRCode({
      subject,
      totalAmount: selected.price,
      outTradeNo,
    });

    res.status(200).json({
      qrCode: result.qrCode,
      outTradeNo: result.outTradeNo,
      plan,
      planName: selected.name,
      totalAmount: selected.price,
      isDevMode: result.isDevMode || false,
      devPayUrl: result.devPayUrl || null,
      // 返回订单信息供前端轮询
      pollUrl: `/api/check-order?trade_no=${result.outTradeNo}`,
    });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message || '创建支付订单失败' });
  }
}

// 导出价格信息供前端使用
export { PLANS, generateOrderId };
