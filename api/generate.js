// Vercel Serverless Function — OpenAI DALL-E 3 image generation
// Vercel uses Node 18+ which has native fetch() — no import needed
// Requires OPENAI_API_KEY env var. Optional: SUPABASE_URL + SUPABASE_SERVICE_KEY for quota

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, style, type } = req.body || {};
    if (!prompt) return res.status(400).json({ error: '缺少 prompt 参数' });

    // Optional auth check: if Supabase is configured, verify user token
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    let userId = null;
    if (authToken && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      try {
        const { data: { user } } = await sb.auth.getUser(authToken);
        if (user) {
          userId = user.id;
          // Check quota (for authenticated users)
          const { data: profile } = await sb.from('users').select('generations_used, generations_limit').eq('id', userId).single();
          if (profile && profile.generations_used >= profile.generations_limit) {
            return res.status(403).json({
              error: '本月生成次数已用完',
              used: profile.generations_used,
              limit: profile.generations_limit,
              code: 'quota_exceeded',
            });
          }
        }
      } catch (e) {
        // Token invalid — proceed without auth
        console.log('Auth check skipped:', e.message);
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '服务器未配置 API Key' });

    // Build an enhanced prompt using the user's inputs
    const enhanced = `${prompt}. Style: ${style || 'modern'}, purpose: ${type || 'thumbnail'}, professional, high quality, suitable for commercial use, no watermark, no text unless specified. 4K quality, detailed, well-composed.`;

    const model = process.env.MODEL || 'dall-e-3';
    const size = model === 'dall-e-3' ? '1024x1024' : '512x512';

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        prompt: enhanced,
        n: 1,
        size,
        quality: 'standard'
      })
    });

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({ error: 'API 调用频率过高，请稍后重试' });
      }
      return res.status(response.status).json({ error: data.error?.message || 'API 调用失败' });
    }

    // Record the generation and increment counter (if authenticated)
    if (userId && process.env.SUPABASE_URL) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        await sb.from('generations').insert({
          user_id: userId,
          prompt,
          style,
          type,
          image_url: data.data[0].url,
        });
        await sb.from('users').update({ generations_used: sb.rpc('increment', { x: 1 }) }).eq('id', userId);
      } catch (e) {
        console.error('Failed to record generation:', e.message);
      }
    }

    res.status(200).json({
      imageUrl: data.data[0].url,
      prompt: enhanced,
      model,
      remaining: null, // TODO: return remaining quota
    });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: '生成失败，请稍后重试' });
  }
}
