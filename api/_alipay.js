// 支付宝当面付工具模块
// 使用 Node.js 内置 crypto 模块，无额外依赖
//
// 环境变量：
//   ALIPAY_APP_ID        — 支付宝应用 ID
//   ALIPAY_PRIVATE_KEY   — 商户 RSA2 私钥 (PKCS1/PKCS8 格式)
//   ALIPAY_PUBLIC_KEY    — 支付宝公钥 (用于验证回调)
//   ALIPAY_NOTIFY_URL    — 支付回调通知 URL (可选，默认自动生成)
//   ALIPAY_RETURN_URL    — 支付后跳转 URL (可选)

import crypto from 'node:crypto';

// ===== 配置 =====
const GATEWAY = 'https://openapi.alipay.com/gateway.do';
const CHARSET = 'utf-8';
const SIGN_TYPE = 'RSA2';
const VERSION = '1.0';
const FORMAT = 'JSON';

function getConfig() {
  return {
    appId: process.env.ALIPAY_APP_ID,
    privateKey: process.env.ALIPAY_PRIVATE_KEY,
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
    notifyUrl: process.env.ALIPAY_NOTIFY_URL,
    returnUrl: process.env.ALIPAY_RETURN_URL,
  };
}

// ===== 签名工具 =====

// 将参数对象排序并拼接为查询字符串
function buildParams(params) {
  const sorted = Object.keys(params).sort();
  return sorted
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
}

// RSA2 签名
function sign(data, privateKey) {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(data, CHARSET);
  return signer.sign(privateKey, 'base64');
}

// RSA2 验签
function verify(data, signature, publicKey) {
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(data, CHARSET);
  return verifier.verify(publicKey, signature, 'base64');
}

// 生成公共请求参数
function buildCommonParams(method, cfg) {
  return {
    app_id: cfg.appId,
    method,
    format: FORMAT,
    charset: CHARSET,
    sign_type: SIGN_TYPE,
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, '+08:00').replace('T', ' '),
    version: VERSION,
  };
}

// ===== API 调用 =====

// 调用支付宝开放平台 API (GET 方式)
export async function callAlipayApi(method, bizContent, cfg) {
  const params = {
    ...buildCommonParams(method, cfg),
    biz_content: JSON.stringify(bizContent),
  };

  // 生成待签名字符串
  const signStr = buildParams(params);
  params.sign = sign(signStr, cfg.privateKey);

  // 拼接完整 URL
  const queryString = buildParams(params);
  const url = `${GATEWAY}?${queryString}`;

  // 发送请求
  const response = await fetch(url, { method: 'GET' });
  const text = await response.text();

  // 解析响应
  const resultKey = `${method.replace(/\./g, '_')}_response`;
  const match = text.match(new RegExp(`"${resultKey}":\\s*(\\{.+?\\})`));
  if (!match) {
    throw new Error(`支付宝 API 返回异常: ${text.slice(0, 300)}`);
  }

  const result = JSON.parse(match[1]);
  if (result.code !== '10000') {
    throw new Error(`支付宝错误: ${result.sub_msg || result.msg || '未知错误'} (${result.code})`);
  }

  return result;
}

// ===== 业务接口 =====

// 创建当面付二维码 (alipay.trade.precreate)
// 返回 { qrCode, outTradeNo }
export async function createAlipayQRCode({ subject, totalAmount, outTradeNo, notifyUrl }) {
  const cfg = getConfig();
  if (!cfg.appId || !cfg.privateKey) {
    // 开发模式：返回模拟二维码
    return createDevPayment({ subject, totalAmount, outTradeNo });
  }

  const bizContent = {
    out_trade_no: outTradeNo,
    total_amount: totalAmount.toFixed(2),
    subject,
    qr_code_timeout_express: '30m',
    ...(notifyUrl || cfg.notifyUrl ? { notify_url: notifyUrl || cfg.notifyUrl } : {}),
  };

  const result = await callAlipayApi('alipay.trade.precreate', bizContent, cfg);
  return { qrCode: result.qr_code, outTradeNo };
}

// 查询订单状态
export async function queryAlipayOrder(outTradeNo) {
  const cfg = getConfig();
  if (!cfg.appId) {
    return { trade_status: 'TRADE_SUCCESS', out_trade_no: outTradeNo }; // 模拟
  }

  const result = await callAlipayApi('alipay.trade.query', { out_trade_no: outTradeNo }, cfg);
  return result;
}

// 验证支付宝回调通知的签名
export function verifyAlipayNotify(params) {
  const cfg = getConfig();
  // 开发模式：不验证
  if (!cfg.alipayPublicKey) return true;

  const sign = params.sign;
  const signType = params.sign_type;
  delete params.sign;
  delete params.sign_type;

  const signStr = buildParams(params);
  return verify(signStr, sign, cfg.alipayPublicKey);
}

// ===== 开发模式 =====
// 当未配置支付宝时，生成模拟支付二维码

const devOrderStore = new Map();

function createDevPayment({ subject, totalAmount, outTradeNo }) {
  // 使用草料二维码 API 生成二维码（指向一个支付模拟页面）
  const mockPayUrl = `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/alipay-mock?trade_no=${outTradeNo}&amount=${totalAmount.toFixed(2)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mockPayUrl)}`;

  // 存储订单状态
  devOrderStore.set(outTradeNo, {
    subject,
    totalAmount,
    status: 'WAIT_BUYER_PAY',
    createdAt: Date.now(),
  });

  // 模拟支付回调（30 秒后自动标记为成功）
  setTimeout(() => {
    const order = devOrderStore.get(outTradeNo);
    if (order && order.status === 'WAIT_BUYER_PAY') {
      order.status = 'TRADE_SUCCESS';
      console.log(`[支付宝开发模式] 订单 ${outTradeNo} 模拟支付成功`);
    }
  }, 30000);

  return {
    qrCode: qrCodeUrl,
    outTradeNo,
    isDevMode: true,
    devPayUrl: mockPayUrl,
  };
}

// 开发模式下查询订单状态
export function getDevOrderStatus(outTradeNo) {
  const order = devOrderStore.get(outTradeNo);
  if (!order) return null;
  return {
    out_trade_no: outTradeNo,
    trade_status: order.status,
    total_amount: order.totalAmount,
    subject: order.subject,
  };
}

// 开发模式下模拟支付成功（用于手动测试）
export function mockDevPaymentSuccess(outTradeNo) {
  const order = devOrderStore.get(outTradeNo);
  if (order) {
    order.status = 'TRADE_SUCCESS';
    return true;
  }
  return false;
}
