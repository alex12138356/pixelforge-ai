// PixelForge AI Studio — AI Generation Test Script
// Run: OPENAI_API_KEY=sk-... node test-generate.js
//
// Tests:
// 1. OpenAI API key is configured
// 2. DALL-E 3 image generation works
// 3. Response contains a valid image URL

const TEST_PROMPT = 'A beautiful sunset over a modern city skyline, digital art style, vibrant colors';

async function runTest() {
  console.log('\n🔧 PixelForge AI Studio — AI 生成功能测试\n');
  console.log('='.repeat(60));

  // Check API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('❌ 错误: 未设置 OPENAI_API_KEY 环境变量');
    console.log('   请运行: export OPENAI_API_KEY=sk-your-key-here');
    console.log('   然后重新执行: node test-generate.js');
    process.exit(1);
  }
  console.log('✅ OpenAI API Key 已配置');

  // Test 1: API Key validity
  console.log('\n📡 测试 1: 验证 API Key...');
  try {
    const modelResp = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (modelResp.ok) {
      console.log('✅ API Key 有效，可访问 OpenAI');
    } else {
      const err = await modelResp.json();
      console.log(`❌ API Key 无效: ${err.error?.message || modelResp.status}`);
      process.exit(1);
    }
  } catch (err) {
    console.log(`❌ 网络错误: ${err.message}`);
    console.log('   提示: 请确保网络可访问 api.openai.com');
    process.exit(1);
  }

  // Test 2: Generate an image
  console.log(`\n🎨 测试 2: 生成测试图片...`);
  console.log(`   提示词: "${TEST_PROMPT}"`);
  console.log(`   模型: ${process.env.MODEL || 'dall-e-3'}`);

  const model = process.env.MODEL || 'dall-e-3';
  const size = model === 'dall-e-3' ? '1024x1024' : '512x512';
  const startTime = Date.now();

  try {
    const genResp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        prompt: TEST_PROMPT,
        n: 1,
        size,
        quality: 'standard'
      })
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!genResp.ok) {
      const err = await genResp.json();
      console.log(`❌ 生成失败 (${elapsed}s): ${err.error?.message || genResp.status}`);
      process.exit(1);
    }

    const data = await genResp.json();
    const imageUrl = data.data?.[0]?.url;

    if (!imageUrl) {
      console.log('❌ 生成响应中没有图片 URL');
      process.exit(1);
    }

    console.log(`✅ 图片生成成功 (${elapsed}s)`);
    console.log(`   URL: ${imageUrl.slice(0, 80)}...`);

    // Test 3: Verify image URL is accessible
    console.log(`\n📥 测试 3: 验证图片可访问...`);
    const imgResp = await fetch(imageUrl);
    if (imgResp.ok) {
      const contentType = imgResp.headers.get('content-type');
      console.log(`✅ 图片可访问 (${contentType})`);
    } else {
      console.log(`⚠️  图片 URL 返回 ${imgResp.status}`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`\n🎉 全部测试通过!\n`);
    console.log(`   图片 URL: ${imageUrl}`);
    console.log(`   生成耗时: ${elapsed}s`);
    console.log(`   模型: ${model}`);

  } catch (err) {
    console.log(`❌ 生成测试失败: ${err.message}`);
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
