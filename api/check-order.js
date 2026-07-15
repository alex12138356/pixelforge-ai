// 查询订单支付状态
// GET /api/check-order?trade_no=xxx
// 前端轮询此接口判断用户是否已付款

import { queryPayJSOrder, getDevOrderStatus } from './_payjs.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const tradeNo = req.query?.trade_no;
    if (!tradeNo) return res.status(400).json({ error: '缺少订单号' });

    let result;
    const cfg = { key: process.env.PAYJS_KEY };

    if (!cfg.key) {
      // 开发模式：查本地存储
      result = getDevOrderStatus(tradeNo);
      if (!result) return res.status(404).json({ error: '订单不存在' });
    } else {
      result = await queryPayJSOrder(tradeNo);
    }

    res.status(200).json({
      paid: result.paid,
      status: result.status,
      totalFee: result.totalFee,
      outTradeNo: result.outTradeNo,
    });
  } catch (err) {
    console.error('Query order error:', err);
    res.status(500).json({ error: '查询订单失败' });
  }
}
