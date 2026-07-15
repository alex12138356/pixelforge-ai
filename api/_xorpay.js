// XorPay 支付模块 (根据官方文档实现)
// 文档: https://xorpay.com/htdocs/xorpay.md
//
// 签名规则: MD5(name + pay_type + price + order_id + notify_url + app_secret)
// API端点: POST https://xorpay.com/api/pay/{aid}
// 价格格式: 字符串 "19.90" (两位小数，不能用float)
//
// 环境变量：
//   XORPAY_AID        — 商户 aid (在 xorpay.com 后台获取)
//   XORPAY_APP_SECRET — 商户密钥
// 不配置时自动走开发模式

import crypto from 'node:crypto';

function getConfig() {
  return {
    aid: process.env.XORPAY_AID,
    appSecret: process.env.XORPAY_APP_SECRET,
    notifyUrl: process.env.XORPAY_NOTIFY_URL,
  };
}

// 签名：参数值按固定顺序拼接 → UTF-8 MD5 → 32位小写十六进制
// 统一下单顺序: name + pay_type + price + order_id + notify_url + app_secret
function signCreate(params, appSecret) {
  const str = params.name + params.pay_type + params.price + params.order_id + params.notify_url + appSecret;
  return crypto.createHash('md5').update(str, 'utf-8').digest('hex').toLowerCase();
}

// 订单查询签名: order_id + app_secret
function signQuery(orderId, appSecret) {
  return crypto.createHash('md5').update(orderId + appSecret, 'utf-8').digest('hex').toLowerCase();
}

// 回调验签: aoid + order_id + pay_price + pay_time + app_secret
function signNotify(params, appSecret) {
  const str = params.aoid + params.order_id + params.pay_price + params.pay_time + appSecret;
  return crypto.createHash('md5').update(str, 'utf-8').digest('hex').toLowerCase();
}

// 统一下单
// 支持 pay_type: native(微信扫码) / alipay(支付宝扫码)
export async function createXorPayOrder({ totalFee, outTradeNo, body, payType }) {
  const cfg = getConfig();
  if (!cfg.aid || !cfg.appSecret) {
    return createDevPayment({ totalFee, outTradeNo, body });
  }

  const price = totalFee.toFixed(2); // 必须字符串两位小数
  const payTypeFinal = payType || 'alipay';
  const notifyUrl = cfg.notifyUrl || `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/check-order`;

  const params = {
    name: body,
    pay_type: payTypeFinal,
    price: price,
    order_id: outTradeNo,
    notify_url: notifyUrl,
  };
  params.sign = signCreate(params, cfg.appSecret);

  const response = await fetch(`https://xorpay.com/api/pay/${cfg.aid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const data = await response.json();

  if (data.status !== 'ok') {
    throw new Error(`XorPay 错误: ${data.status} - ${data.msg || data.info || '下单失败'}`);
  }

  return {
    orderId: data.aoid || outTradeNo,
    qrCode: data.info?.qr || null,
    codeUrl: data.info?.qr || null,
    outTradeNo,
    payType: payTypeFinal,
    isDevMode: false,
  };
}

// 订单查询（按商户号）
export async function queryXorPayOrder(tradeNo) {
  const cfg = getConfig();
  if (!cfg.aid || !cfg.appSecret) {
    return getDevOrderStatus(tradeNo);
  }

  const sign = signQuery(tradeNo, cfg.appSecret);

  const response = await fetch(`https://xorpay.com/api/query2/${cfg.aid}?order_id=${tradeNo}&sign=${sign}`);
  const data = await response.json();
  const map = { not_exist: 0, new: 0, payed: 1, success: 1, expire: -1, fee_error: -2 };

  return {
    paid: data.status === 'payed' || data.status === 'success',
    status: map[data.status] ?? 0,
    rawStatus: data.status,
    tradeNo,
    orderId: data.aoid,
    payPrice: data.pay_price,
  };
}

// 验证回调签名
export function verifyXorPayNotify(params) {
  const cfg = getConfig();
  if (!cfg.appSecret) return true; // 开发模式不验证
  const expectedSign = signNotify(params, cfg.appSecret);
  return params.sign === expectedSign;
}

// ===== 开发模式（无配置时自动启用）=====
const devOrderStore = new Map();

function createDevPayment({ totalFee, outTradeNo, body }) {
  const devAmount = totalFee.toFixed(2);
  const host = process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000';
  const mockUrl = `${host}/api/mock-pay-page?trade_no=${outTradeNo}&amount=${devAmount}`;
  const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mockUrl)}`;

  devOrderStore.set(outTradeNo, {
    paid: false, status: 0, totalFee, outTradeNo, createdAt: Date.now(),
  });

  // 30 秒后自动支付（模拟回调）
  setTimeout(() => {
    const order = devOrderStore.get(outTradeNo);
    if (order && !order.paid) { order.paid = true; order.status = 1; }
  }, 30000);

  return {
    orderId: outTradeNo, qrCode, codeUrl: mockUrl, outTradeNo,
    payType: 'dev',
    isDevMode: true, devPayUrl: mockUrl,
  };
}

function getDevOrderStatus(tradeNo) {
  const order = devOrderStore.get(tradeNo);
  return order || null;
}

export function mockPaySuccess(tradeNo) {
  const order = devOrderStore.get(tradeNo);
  if (order) { order.paid = true; order.status = 1; return true; }
  return false;
}
