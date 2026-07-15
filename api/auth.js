// Vercel Serverless Function — User Authentication API
// Uses Supabase for auth, requires SUPABASE_URL and SUPABASE_SERVICE_KEY env vars
//
// POST /api/auth?action=register — 注册
// POST /api/auth?action=login    — 登录 (使用 Supabase Auth)
// GET  /api/auth?token=xxx       — 获取当前用户信息

import { createClient } from '@supabase/supabase-js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = getSupabase();
  if (!sb) {
    return res.status(500).json({ error: 'Supabase 未配置，请在 Vercel 环境变量中设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY' });
  }

  const action = req.query?.action || '';

  // ===== REGISTER =====
  if (action === 'register' && req.method === 'POST') {
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: '请填写邮箱和密码' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });

    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: name || email.split('@')[0] },
      });

      if (authError) {
        return res.status(400).json({ error: authError.message.includes('already') ? '该邮箱已注册' : authError.message });
      }

      // Create user profile in users table
      await sb.from('users').insert({
        id: authData.user.id,
        email,
        name: name || email.split('@')[0],
      });

      return res.status(200).json({ success: true, message: '注册成功！请登录' });
    } catch (err) {
      return res.status(500).json({ error: '注册失败: ' + err.message });
    }
  }

  // ===== LOGIN =====
  if (action === 'login' && req.method === 'POST') {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: '请填写邮箱和密码' });

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        return res.status(401).json({ error: '邮箱或密码错误' });
      }
      // Get user profile
      const { data: profile } = await sb.from('users').select('*').eq('id', data.user.id).single();
      return res.status(200).json({
        token: data.session.access_token,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: profile?.name || data.user.email?.split('@')[0],
          generations_used: profile?.generations_used || 0,
          generations_limit: profile?.generations_limit || 3,
          subscription_plan: profile?.subscription_plan || 'free',
          subscription_status: profile?.subscription_status || 'inactive',
        },
      });
    } catch (err) {
      return res.status(500).json({ error: '登录失败: ' + err.message });
    }
  }

  // ===== GET USER (token) =====
  if (action === 'me' && req.method === 'GET') {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: '未登录' });

    try {
      const { data: { user }, error } = await sb.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: '登录已过期，请重新登录' });

      const { data: profile } = await sb.from('users').select('*').eq('id', user.id).single();
      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          name: profile?.name || user.email?.split('@')[0],
          generations_used: profile?.generations_used || 0,
          generations_limit: profile?.generations_limit || 3,
          subscription_plan: profile?.subscription_plan || 'free',
          subscription_status: profile?.subscription_status || 'inactive',
        },
      });
    } catch (err) {
      return res.status(500).json({ error: '获取用户信息失败' });
    }
  }

  return res.status(400).json({ error: '无效的请求' });
}
