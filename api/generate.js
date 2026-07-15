// Vercel Serverless Function — OpenAI DALL-E 3 image generation
// Deploy on Vercel free tier: https://vercel.com
// Cost: ~$0.04–$0.08 per image via DALL-E 3

const fetch = (url, opts) => import('node-fetch').then(m => m.default(url, opts));

export default async function handler(req, res) {
  // CORS headers — allow your frontend domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, style, type } = req.body || {};
    if (!prompt) return res.status(400).json({ error: '缺少 prompt 参数' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '服务器未配置 API Key' });

    // Build an enhanced prompt
    const enhanced = `${prompt}. Style: ${style || 'modern'}, purpose: ${type || 'thumbnail'}, professional, high quality, suitable for commercial use, no watermark, no text unless specified. 4K quality, detailed, well-composed.`;

    // Free / cheaper alternative: use DALL-E 2 ($0.02/image) instead of DALL-E 3 ($0.04-0.08)
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
      return res.status(response.status).json({ error: data.error?.message || 'API 调用失败' });
    }

    res.status(200).json({
      imageUrl: data.data[0].url,
      prompt: enhanced,
      model
    });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: '生成失败，请稍后重试' });
  }
}
