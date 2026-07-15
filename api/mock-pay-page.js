// 开发模式：模拟支付页面
// GET /api/mock-pay-page?trade_no=xxx&amount=19.90
// 仅当未配置 PayJS 时使用

import { mockPaySuccess } from './_payjs.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const tradeNo = req.query?.trade_no;
  const amount = req.query?.amount || '0.00';

  // If this is called with action param, handle the mock payment
  if (req.query?.action === 'pay' && tradeNo) {
    const ok = mockPaySuccess(tradeNo);
    return res.status(200).json({ ok });
  }

  // Otherwise, serve the HTML page
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>模拟支付 - PixelForge</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#0f0f18,#1a1a2e);color:#e8e8f0}
.card{background:#181825;border:1px solid #2e2e50;border-radius:20px;padding:40px;text-align:center;max-width:400px;width:90%}
.icon{font-size:56px;margin-bottom:16px}
h2{font-size:22px;font-weight:700;margin-bottom:8px}
.sub{color:#7a7a9a;font-size:14px;margin-bottom:24px}
.price{font-size:36px;font-weight:800;color:#a29bfe;margin:16px 0}
.orderno{font-size:12px;color:#4a4a6a;margin-bottom:24px;word-break:break-all}
.btn{background:linear-gradient(135deg,#6c5ce7,#a29bfe);color:white;border:none;padding:14px 40px;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;transition:transform .2s,box-shadow .2s;display:block;margin:0 auto}
.btn:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(108,92,231,.35)}
.note{font-size:12px;color:#4a4a6a;margin-top:16px}
.success{display:none}
.success.show{display:block}
.success-icon{font-size:64px;margin-bottom:16px}
</style></head>
<body>
<div class="card">
  <div class="icon" id="icon">&#x1F4B5;</div>
  <h2 id="title">开发模式 · 模拟支付</h2>
  <p class="sub" id="desc">这是开发模式下的测试支付页面</p>
  <div class="price" id="amount">&#x00A5;${amount}</div>
  <p class="orderno" id="orderNo">订单号: ${tradeNo}</p>
  <button class="btn" id="payBtn" onclick="pay()">&#x2705; 模拟支付成功</button>
  <p class="note" id="note">点击后模拟支付成功，页面将自动关闭</p>
  <div class="success" id="success">
    <div class="success-icon">&#x2705;</div>
    <h2>支付成功!</h2>
    <p class="sub">3 秒后自动关闭，请返回原页面</p>
  </div>
</div>
<script>
function pay(){
  var btn = document.getElementById('payBtn');
  btn.textContent = '处理中...';
  btn.disabled = true;
  fetch('/api/mock-pay-page?action=pay&trade_no=${tradeNo}')
    .then(function(r){return r.json()})
    .then(function(d){
      document.querySelector('.card').classList.add('success');
      document.getElementById('icon').style.display = 'none';
      document.getElementById('title').style.display = 'none';
      document.getElementById('desc').style.display = 'none';
      document.getElementById('amount').style.display = 'none';
      document.getElementById('orderNo').style.display = 'none';
      document.getElementById('payBtn').style.display = 'none';
      document.getElementById('note').style.display = 'none';
      document.getElementById('success').classList.add('show');
      setTimeout(function(){window.close()}, 3000);
    })
    .catch(function(){
      btn.textContent = '重试';
      btn.disabled = false;
    });
}
</script>
</body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).end(html);
}
