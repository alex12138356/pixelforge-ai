# PixelForge AI Studio — 完整部署 & 配置指南

一个可直接商用的 AI 内容创作 SaaS，5 分钟部署上线。

---

## 一键部署 (5分钟)

### 1. 注册免费账号
- [Vercel](https://vercel.com) — 用 GitHub 登录
- [OpenAI](https://platform.openai.com) — 获取 API Key
- [PayJS开放平台](https://open.alipay.com) — 注册开发者 (可选，用于收款)

### 2. 部署
```bash
cd outputs/ai-studio
git init
git add .
git commit -m "init"
# 在 GitHub 新建仓库后：
git remote add origin https://github.com/alex12138356/pixelforge-ai.git
git push -u origin main
```

然后打开 [Vercel](https://vercel.com/new) → 导入仓库 → 添加环境变量 → Deploy

### 3. 设置 Vercel 环境变量
| 变量名 | 必填 | 说明 |
|--------|------|------|
| `OPENAI_API_KEY` | ✅ | OpenAI API Key |
| `MODEL` | ❌ | 默认 `dall-e-3`，可选 `dall-e-2` (更便宜) |
| `ALIPAY_APP_ID` | ❌ | PayJS应用 ID (不配则自动走开发模式) |
| `ALIPAY_PRIVATE_KEY` | ❌ | RSA2 商户私钥 |
| `ALIPAY_PUBLIC_KEY` | ❌ | PayJS公钥 |
| `SUPABASE_URL` | ❌ | Supabase 项目 URL (用户系统) |
| `SUPABASE_SERVICE_KEY` | ❌ | Supabase 服务端 Key |

---

## 配置 OpenAI (免费注册)

1. 访问 [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. 点击 **Create new secret key**
3. 复制 Key，粘贴到 Vercel 环境变量 `OPENAI_API_KEY`

**成本：** DALL-E 3 = $0.04/张，DALL-E 2 = $0.02/张

---

## 配置 PayJS 支付 (可选)

不配置 PayJS 也能用——系统会自动进入**开发模式**，显示模拟支付二维码，点一下就算付款成功。

正式上线需要以下步骤：

### 1. 注册 PayJS
打开 [payjs.cn](https://payjs.cn)，用微信扫码注册。

### 2. 获取商户号
注册完成后，在后台找到：
- **商户号 (MCHID)** — 一串数字
- **商户密钥 (Key)** — 一串字符串

### 3. 添加 Vercel 环境变量
```
PAYJS_MCHID=你的商户号
PAYJS_KEY=你的商户密钥
```

PayJS 支持支付宝和微信扫码支付，费率约 0.38%-1.5%，提现到个人支付宝或微信。

---

## 本地开发测试

### 前置条件
```bash
cd outputs/ai-studio
pnpm install   # 或 npm install
```

### 启动开发服务器
```bash
export OPENAI_API_KEY=sk-your-key-here
node dev-server.js
# 访问 http://localhost:3000
```

### 测试 AI 生成功能
```bash
export OPENAI_API_KEY=sk-your-key-here
node test-generate.js
```

### 测试PayJS支付流程
1. 启动开发服务器
2. 打开 `http://localhost:3000`
3. 点击任意定价方案的"立即订阅"
4. 弹窗显示支付二维码（开发模式）
5. 点击弹窗中的"模拟支付"链接
6. 在新页面点击"模拟支付成功"按钮
7. 回到原页面，支付成功 ✅

---

## 用户系统 (Supabase)

可选功能。注册 Supabase 后：
1. 在 SQL Editor 运行 `supabase-schema.sql`
2. 添加 `SUPABASE_URL` 和 `SUPABASE_SERVICE_KEY` 到 Vercel
3. 前端会出现登录/注册功能
4. 用户可管理自己的生成用量和套餐

---

## 成本结构

| 项目 | 费用 |
|------|------|
| Vercel 托管 | 免费 |
| OpenAI API (DALL-E 3) | $0.04/张 |
| PayJS支付 | 免费开通，0.6%/笔（国内商家费率） |
| 域名 (可选) | ¥30–¥80/年 |
| **每月最低** | **¥0 + 按量付费** |

---

## 变现策略

### 直接卖订阅 (¥19.90–¥149.90/月)
| 套餐 | 价格 | 说明 |
|------|------|------|
| 基础版 | ¥19.90/月 | 50 次 AI 生成 |
| 专业版 | ¥49.90/月 | 200 次 AI 生成 |
| 企业版 | ¥149.90/月 | 无限 AI 生成 |

### 卖 AI 生成资产包 (¥19–¥89/套)
- 把 AI 生成的作品打包成模板上架
- 平台：Gumroad、Creative Market、Etsy

### 代运营服务 (¥500–¥3000/月)
- 用这个工具为客户批量生产内容
- 收服务费，成本几乎为零

---

## 盈利测算 (假设专业版 ¥49.90/月)

| 客户数 | 月收入 | 月成本 (API) | 利润 |
|--------|--------|-------------|------|
| 1 | ¥49.90 | ~¥0.30 | **¥49.60** |
| 10 | ¥499 | ~¥3 | **¥496** |
| 50 | ¥2,495 | ~¥15 | **¥2,480** |
| 100 | ¥4,990 | ~¥30 | **¥4,960** |

第一个客户就回本。

---

## 技术栈
- 前端: 纯 HTML/CSS/JS (零依赖)
- API: Vercel Serverless Functions (Node.js 18+)
- AI: OpenAI DALL-E 3 / DALL-E 2
- 支付: PayJS (开发模式无需配置)
- 用户系统: Supabase (可选)
- 部署: Vercel (免费套餐)
- 本地开发: Node.js dev-server.js
