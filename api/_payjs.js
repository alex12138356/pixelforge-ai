// PayJS 聚合支付模块
// 支持支付宝 + 微信扫码支付，无需营业执照，个人即可接入
// 官网: https://payjs.cn
//
// 环境变量：
//   PAYJS_MCHID         — 商户号 (在 payjs.cn 后台获取)
//   PAYJS_KEY           — 商户密钥 (在 payjs.cn 后台获取)
//
// 不配置时自动走开发模式（显示模拟二维码）

import crypto from 'node:crypto';

// ===== 配置 =====
const API_BASE = 'https://payjs.cn/api';
const KEY = 'key';  // 签名参数名

function getConfig() {
  return {
    mchid: process.env.PAYJS_MCHID,
    key: process.env.PAYJS_KEY,
    notifyUrl: process.env.PAYJS_NOTIFY_URL,
  };
}

// ===== 签名工具 =====

// MD5 签名：排序参数 + key
function sign(params, key) {
  const sorted = Object.keys(params).sort();
  const str = sorted.map(k => `${k}=${params[k]}`).join('&') + `&${KEY}=${key}`;
  return crypto.createHash('md5').update(str, 'utf-8').digest('hex').toUpperCase();
}

// 验证回调签名
function verifySign(params, key) {
  const receivedSign = params.sign;
  const paramsToSign = { ...params };
  delete paramsToSign.sign;
  const expectedSign = sign(paramsToSign, key);
  return receivedSign === expectedSign;
}

// ===== API 调用 =====

// 创建扫码支付订单
// 返回 { payjsOrderId, qrCode, codeUrl }
export async function createPayJSOrder({ totalFee, outTradeNo, body, notifyUrl }) {
  const cfg = getConfig();

  // 开发模式
  if (!cfg.mchid || !cfg.key) {
    return createDevPayment({ totalFee, outTradeNo, body });
  }

  const params = {
    mchid: cfg.mchid,
    total_fee: totalFee,        // 单位：分 (如 1990 = ¥19.90)
    out_trade_no: outTradeNo,
    body,
    notify_url: notifyUrl || cfg.notifyUrl || '',
    format: 'json',
  };
  params.sign = sign(params, cfg.key);

  const response = await fetch(API_BASE + '/native', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const data = await response.json();

  if (data.return_code !== 1) {
    throw new Error(`PayJS 错误: ${data.return_msg || '创建订单失败'}`);
  }

  return {
    payjsOrderId: data.payjs_order_id,
    qrCode: data.qrcode,      // base64 PNG 图片数据
    codeUrl: data.code_url,    // 二维码内容 URL
    outTradeNo,
  };
}

// 查询订单支付状态
export async function queryPayJSOrder(payjsOrderId) {
  const cfg = getConfig();

  // 开发模式
  if (!cfg.key) {
    return getDevOrderStatus(payjsOrderId);
  }

  const params = { payjs_order_id: payjsOrderId };
  params.sign = sign(params, cfg.key);

  const response = await fetch(API_BASE + '/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const data = await response.json();

  return {
    paid: data.status === 1,
    status: data.status,
    totalFee: data.total_fee,
    outTradeNo: data.out_trade_no,
    payjsOrderId: data.payjs_order_id,
  };
}

// 验证 PayJS 回调通知
export function verifyPayJSNotify(params) {
  const cfg = getConfig();
  if (!cfg.key) return true; // 开发模式不验证
  return verifySign(params, cfg.key);
}

// ===== 开发模式 =====

const devOrderStore = new Map();

function createDevPayment({ totalFee, outTradeNo, body }) {
  const devAmount = (totalFee / 100).toFixed(2);
  const mockUrl = `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/mock-pay-page?trade_no=${outTradeNo}&amount=${devAmount}`;
  
  // 用 qrserver 生成二维码
  const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mockUrl)}`;

  devOrderStore.set(outTradeNo, {
    payjsOrderId: outTradeNo,
    paid: false,
    status: 0,
    totalFee,
    outTradeNo,
    createdAt: Date.now(),
  });

  // 30 秒后自动标记为已支付（模拟回调）
  setTimeout(() => {
    const order = devOrderStore.get(outTradeNo);
    if (order && !order.paid) {
      order.paid = true;
      order.status = 1;
      console.log(`[PayJS 开发模式] 订单 ${outTradeNo} 自动支付成功`);
    }
  }, 30000);

  return {
    payjsOrderId: outTradeNo,
    qrCode,
    codeUrl: mockUrl,
    outTradeNo,
    isDevMode: true,
    devPayUrl: mockUrl,
  };
}

function getDevOrderStatus(payjsOrderId) {
  const order = devOrderStore.get(payjsOrderId);
  if (!order) return null;
  return { ...order };
}

// 开发模式：手动标记支付成功
export function mockPaySuccess(payjsOrderId) {
  const order = devOrderStore.get(payjsOrderId);
  if (order) {
    order.paid = true;
    order.status = 1;
    return true;
  }
  return false;
}

// 开发模式：获取所有订单（管理用）
export function getAllDevOrders() {
  return Array.from(devOrderStore.entries()).map(([id, order]) => ({ id, ...order }));
}
