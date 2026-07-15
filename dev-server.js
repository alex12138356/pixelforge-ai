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

  // ===== Stripe Checkout =====
  if (pathname === '/api/checkout' && req.method === 'POST') {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Stripe 未配置' }));
    }

    try {
      const { Stripe } = await import('stripe');
      const stripe = Stripe(stripeKey);
      const { plan } = await parseBody(req);

      const plans = {
        starter: { name: 'Starter', price: 1900, desc: '50 次 AI 生成/月' },
        creator: { name: 'Creator Pro', price: 4900, desc: '200 次 AI 生成/月' },
        enterprise: { name: 'Enterprise', price: 14900, desc: '无限 AI 生成/月' }
      };

      const selected = plans[plan];
      if (!selected) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: '无效的套餐' }));
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: selected.name,
              description: selected.desc,
            },
            unit_amount: selected.price,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `http://localhost:${PORT}/?success=true`,
        cancel_url: `http://localhost:${PORT}/?canceled=true`,
        metadata: { plan },
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: session.url, sessionId: session.id }));
    } catch (err) {
      console.error('Checkout error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '创建支付会话失败' }));
    }
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

  // ===== Stripe Webhook =====
  if (pathname === '/api/webhook' && req.method === 'POST') {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Stripe 未配置' }));
    }

    try {
      const { Stripe } = await import('stripe');
      const stripe = Stripe(stripeKey);
      const body = await parseBody(req);
      const event = body;

      switch (event.type) {
        case 'checkout.session.completed':
          console.log('✅ Checkout completed:', event.data?.object?.id);
          break;
        case 'customer.subscription.deleted':
          console.log('❌ Subscription canceled');
          break;
        case 'invoice.payment_succeeded':
          console.log('💰 Payment received');
          break;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true }));
    } catch (err) {
      console.error('Webhook error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Webhook handler failed' }));
    }
    return;
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
