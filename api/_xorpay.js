// XorPay (虎皮椒) 支付模块
// 注册: https://www.xorpay.com (手机号即可，无需营业执照)
// 支持支付宝 + 微信扫码，提现到个人支付宝
//
// 环境变量：
//   XORPAY_APPID        — 商户 appid
//   XORPAY_APPSECRET    — 商户密钥
// 不配置时自动走开发模式

import crypto from 'node:crypto';

const API_BASE = 'https://api.xorpay.com';

function getConfig() {
  return {
    appid: process.env.XORPAY_APPID,
    appsecret: process.env.XORPAY_APPSECRET,
    notifyUrl: process.env.XORPAY_NOTIFY_URL,
  };
}

// XorPay 签名规则：md5(appid + appsecret + trade_no + money + name + notify_url)
function sign(params, appsecret) {
  const str = params.appid + appsecret + params.trade_no + params.money + params.name + (params.notify_url || '');
  return crypto.createHash('md5').update(str, 'utf-8').digest('hex').toLowerCase();
}

function querySign(params, appsecret) {
  const str = params.appid + appsecret + params.trade_no;
  return crypto.createHash('md5').update(str, 'utf-8').digest('hex').toLowerCase();
}

// 创建扫码支付订单
export async function createXorPayOrder({ totalFee, outTradeNo, body, notifyUrl }) {
  const cfg = getConfig();
  if (!cfg.appid || !cfg.appsecret) {
    return createDevPayment({ totalFee, outTradeNo, body });
  }

  const money = totalFee.toFixed(2);
  const params = {
    appid: cfg.appid,
    trade_no: outTradeNo,
    money,
    name: body,
    notify_url: notifyUrl || cfg.notifyUrl || '',
  };
  params.sign = sign(params, cfg.appsecret);

  const response = await fetch(API_BASE + '/api/pay/native', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const data = await response.json();

  if (data.code !== 1) {
    throw new Error(`XorPay 错误: ${data.msg || '创建订单失败'}`);
  }

  return {
    orderId: data.data.order_id,
    qrCode: data.data.qrcode,
    outTradeNo,
    isDevMode: false,
  };
}

// 查询订单支付状态
export async function queryXorPayOrder(tradeNo) {
  const cfg = getConfig();
  if (!cfg.appid || !cfg.appsecret) {
    return getDevOrderStatus(tradeNo);
  }

  const params = { appid: cfg.appid, trade_no: tradeNo };
  params.sign = querySign(params, cfg.appsecret);

  const response = await fetch(API_BASE + '/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const data = await response.json();

  if (data.code !== 1) {
    return { paid: false, status: 0, tradeNo, error: data.msg };
  }

  return {
    paid: data.data.status === 1,
    status: data.data.status,
    totalFee: data.data.money,
    tradeNo,
  };
}

// ===== 开发模式 =====
const devOrderStore = new Map();

function createDevPayment({ totalFee, outTradeNo, body }) {
  const devAmount = totalFee.toFixed(2);
  const host = process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000';
  const mockUrl = `${host}/api/mock-pay-page?trade_no=${outTradeNo}&amount=${devAmount}`;
  const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mockUrl)}`;

  devOrderStore.set(outTradeNo, {
    paid: false, status: 0, totalFee, outTradeNo, createdAt: Date.now(),
  });

  setTimeout(() => {
    const order = devOrderStore.get(outTradeNo);
    if (order && !order.paid) { order.paid = true; order.status = 1; }
  }, 30000);

  return {
    orderId: outTradeNo, qrCode, codeUrl: mockUrl, outTradeNo,
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
