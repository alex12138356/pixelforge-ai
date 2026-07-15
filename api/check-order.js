// 查询支付宝订单状态
// GET /api/check-order?trade_no=xxx
// 前端轮询此接口判断用户是否已付款

import { queryAlipayOrder, getDevOrderStatus } from './_alipay.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const tradeNo = req.query?.trade_no;
    if (!tradeNo) return res.status(400).json({ error: '缺少订单号' });

    // 开发模式：查本地存储
    const cfg = { appId: process.env.ALIPAY_APP_ID };
    let result;
    if (!cfg.appId) {
      result = getDevOrderStatus(tradeNo);
      if (!result) return res.status(404).json({ error: '订单不存在' });
    } else {
      result = await queryAlipayOrder(tradeNo);
    }

    const paid = result.trade_status === 'TRADE_SUCCESS' || result.trade_status === 'TRADE_FINISHED';

    res.status(200).json({
      tradeNo: result.out_trade_no,
      tradeStatus: result.trade_status,
      paid,
      totalAmount: result.total_amount,
    });
  } catch (err) {
    console.error('Query order error:', err);
    res.status(500).json({ error: '查询订单失败' });
  }
}
