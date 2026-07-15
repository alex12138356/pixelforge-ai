// PixelForge AI Studio — Local Development Server
// Run: node dev-server.js
// Then open http://localhost:3000

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// In-memory auth store for development (no Supabase needed locally)
const DEV_USERS_FILE = path.join(__dirname, '.dev-users.json');
function loadDevUsers() {
  try { return JSON.parse(fs.readFileSync(DEV_USERS_FILE, 'utf-8')); }
  catch { return {}; }
}
function saveDevUsers(users) {
  fs.writeFileSync(DEV_USERS_FILE, JSON.stringify(users, null, 2));
}
function makeToken() {
  return 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2);
}

// MIME types
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

// Parse JSON body
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();

  // ===== API Routes =====
  if (pathname === '/api/generate' && req.method === 'POST') {
    const body = await parseBody(req);
    const { prompt, style, type } = body;

    if (!prompt) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: '缺少 prompt 参数' }));
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: '请设置 OPENAI_API_KEY 环境变量' }));
    }

    try {
      const enhanced = `${prompt}. Style: ${style || 'modern'}, purpose: ${type || 'thumbnail'}, professional, high quality, suitable for commercial use, no watermark.`;
      const model = process.env.MODEL || 'dall-e-3';
      const size = model === 'dall-e-3' ? '1024x1024' : '512x512';

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model, prompt: enhanced, n: 1, size, quality: 'standard' })
      });

      const data = await response.json();
      if (!response.ok) {
        res.writeHead(response.status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: data.error?.message || 'API 调用失败' }));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        imageUrl: data.data[0].url,
        prompt: enhanced,
        model
      }));
    } catch (err) {
      console.error('Generate error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '生成失败: ' + err.message }));
    }
    return;
  }

  // ===== 支付宝当面付 =====
  if (pathname === '/api/checkout' && req.method === 'POST') {
    try {
      const { createPayJSOrder } = await import('./api/_payjs.js');
      const { plan } = await parseBody(req);

      const plans = {
        starter:   { name: '基础版',  price: 19.90 },
        creator:   { name: '专业版',  price: 49.90 },
        enterprise:{ name: '企业版',  price: 149.90 },
      };

      const selected = plans[plan];
      if (!selected) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "无效的套餐" }));
      }

      const outTradeNo = "PF" + Date.now().toString(36) + Math.random().toString(36).slice(2,6).toUpperCase();
      const result = await createPayJSOrder({
        subject: "PixelForge AI - " + selected.name + "套餐",
        totalAmount: selected.price,
        outTradeNo,
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        qrCode: result.qrCode,
        outTradeNo: result.outTradeNo,
        plan,
        planName: selected.name,
        totalAmount: selected.price,
        isDevMode: result.isDevMode || false,
        devPayUrl: result.devPayUrl || null,
        pollUrl: "/api/check-order?trade_no=" + result.outTradeNo,
      }));
    } catch (err) {
      console.error("Checkout error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message || "创建订单失败" }));
    }
    return;
  }

  // ===== 查询订单支付状态 =====
  if (pathname === '/api/check-order' && req.method === 'GET') {
    try {
      const tradeNo = url.searchParams.get("trade_no");
      if (!tradeNo) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "缺少订单号" }));
      }
      const { getDevOrderStatus } = await import('./api/_payjs.js');
      const result = getDevOrderStatus(tradeNo);
      if (!result) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "订单不存在" }));
      }
      const paid = result.trade_status === "TRADE_SUCCESS" || result.trade_status === "TRADE_FINISHED";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        tradeNo: result.out_trade_no,
        tradeStatus: result.trade_status,
        paid,
        totalAmount: result.total_amount,
      }));
    } catch (err) {
      console.error("Query order error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "查询订单失败" }));
    }
    return;
  }

  // ===== 开发模式：模拟支付页面 =====
  if (pathname === '/api/mock-pay-page') {
    const tradeNo = url.searchParams.get("trade_no");
    const amount = url.searchParams.get("amount");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    const mockFile = path.join(__dirname, "mock-pay.html");
    let mockContent = fs.readFileSync(mockFile, "utf-8");
    return res.end(mockContent);
  }

  // ===== 开发模式：模拟支付成功 =====
  if (pathname === '/api/mock-pay') {
    const tradeNo = url.searchParams.get("trade_no");
    const { mockPaySuccess } = await import('./api/_payjs.js');
    const ok = mockPaySuccess(tradeNo);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok }));
    return;
  }

  // ===== Auth API =====
  if (pathname === '/api/auth') {
    const action = url.searchParams.get('action');

    // Register
    if (action === 'register' && req.method === 'POST') {
      const body = await parseBody(req);
      const { email, password, name } = body;
      if (!email || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: '请填写邮箱和密码' }));
      }
      const users = loadDevUsers();
      if (users[email]) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: '该邮箱已注册' }));
      }
      users[email] = { email, password, name: name || email.split('@')[0], generations_used: 0, generations_limit: 3, subscription_plan: 'free', subscription_status: 'inactive', created_at: new Date().toISOString() };
      saveDevUsers(users);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, message: '注册成功！请登录' }));
    }

    // Login
    if (action === 'login' && req.method === 'POST') {
      const body = await parseBody(req);
      const { email, password } = body;
      const users = loadDevUsers();
      const user = users[email];
      if (!user || user.password !== password) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: '邮箱或密码错误' }));
      }
      const token = makeToken();
      // Store session
      const sessions = JSON.parse(fs.readFileSync(path.join(__dirname, '.dev-sessions.json'), 'utf-8') || '{}');
      sessions[token] = email;
      fs.writeFileSync(path.join(__dirname, '.dev-sessions.json'), JSON.stringify(sessions));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        token,
        user: { id: email, email, name: user.name, generations_used: user.generations_used, generations_limit: user.generations_limit, subscription_plan: user.subscription_plan, subscription_status: user.subscription_status }
      }));
    }

    // Get user (me)
    if (action === 'me' && req.method === 'GET') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: '未登录' }));
      }
      try {
        const sessions = JSON.parse(fs.readFileSync(path.join(__dirname, '.dev-sessions.json'), 'utf-8') || '{}');
        const email = sessions[token];
        if (!email) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: '登录已过期' }));
        }
        const users = loadDevUsers();
        const user = users[email];
        if (!user) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: '用户不存在' }));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ user: { id: email, email, name: user.name, generations_used: user.generations_used, generations_limit: user.generations_limit, subscription_plan: user.subscription_plan, subscription_status: user.subscription_status } }));
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: '获取用户信息失败' }));
      }
    }

    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: '无效的请求' }));
  }

  // ===== Static files =====
  // Serve index.html for root
  if (pathname === '/' || pathname === '') {
    return serveStatic(res, path.join(__dirname, 'index.html'));
  }

  // Serve other static files
  const filePath = path.join(__dirname, pathname);
  if (filePath.startsWith(__dirname)) {
    return serveStatic(res, filePath);
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  PixelForge AI Studio 开发服务器已启动\n`);
  console.log(`  → 本地访问: http://localhost:${PORT}`);
  console.log(`  → 生成 API:  POST http://localhost:${PORT}/api/generate`);
  console.log(`  → 支付 API:  POST http://localhost:${PORT}/api/checkout`);
  console.log(`\n  请先设置环境变量:`);
  console.log(`  export OPENAI_API_KEY=sk-...`);
  console.log(`  export STRIPE_SECRET_KEY=sk_test_... (可选)`);
  console.log(`\n`);
});
