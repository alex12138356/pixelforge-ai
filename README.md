# PixelForge AI Studio — 完整部署 & 配置指南

一个可直接商用的 AI 内容创作 SaaS，5 分钟部署上线。

## 目录
- [一键部署](#一键部署-5分钟)
- [OpenAI 配置](#2-配置-openai-免费注册)
- [Stripe 收款配置](#3-配置-stripe-收款-可选)
- [本地开发测试](#本地开发测试)
- [变现策略](#变现策略)

---

## 一键部署 (5分钟)

### 1. 注册免费账号
- [Vercel](https://vercel.com) — 用 GitHub 登录
- [OpenAI](https://platform.openai.com) — 获取 API Key
- [Stripe](https://dashboard.stripe.com/register) — 注册收款账号 (可选)

### 2. 部署
```bash
# 克隆/推送项目到 GitHub
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
| `STRIPE_SECRET_KEY` | ❌ | Stripe Secret Key (开启收款用) |
| `STRIPE_WEBHOOK_SECRET` | ❌ | Stripe Webhook Secret |

---

## 2. 配置 OpenAI (免费注册)

1. 访问 [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. 点击 **Create new secret key**
3. 复制 Key，粘贴到 Vercel 环境变量 `OPENAI_API_KEY`

**成本：** DALL-E 3 = $0.04/张，DALL-E 2 = $0.02/张

---

## 3. 配置 Stripe 收款 (可选)

### 3.1 注册 Stripe
1. 访问 [dashboard.stripe.com/register](https://dashboard.stripe.com/register)
2. 填写邮箱、密码、公司信息
3. 进入 Dashboard

### 3.2 获取 API Key
1. Stripe Dashboard → **Developers** → **API Keys**
2. 复制 **Secret Key** (以 `sk_live_` 开头)
3. 添加到 Vercel 环境变量 `STRIPE_SECRET_KEY`

### 3.3 (可选) 创建固定产品
默认模式会自动在 Stripe 创建产品。如需固定 Price ID：
1. Stripe Dashboard → **Products** → **Add Product**
2. 分别创建三个产品：
   - **Starter** — $19/月，50 次 AI 生成
   - **Creator Pro** — $49/月，200 次 AI 生成
   - **Enterprise** — $149/月，无限 AI 生成
3. 每个产品创建后，复制对应的 **Price ID** (以 `price_` 开头)
4. 添加到 Vercel 环境变量：
   - `PRICE_ID_STARTER` = `price_xxxxx`
   - `PRICE_ID_CREATOR` = `price_xxxxx`
   - `PRICE_ID_ENTERPRISE` = `price_xxxxx`

### 3.4 配置 Webhook (接收付款通知)
1. Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint**
2. **Endpoint URL:** `https://你的域名.vercel.app/api/webhook`
3. **监听事件:**
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. 点击 **Add endpoint**
5. 复制 **Signing secret** (以 `whsec_` 开头)
6. 添加到 Vercel 环境变量 `STRIPE_WEBHOOK_SECRET`

---

## 本地开发测试

### 前置条件
```bash
# 本地运行需要 Node.js 18+
cd outputs/ai-studio
pnpm install   # 或 npm install
```

### 启动开发服务器
```bash
# 设置环境变量
export OPENAI_API_KEY=sk-your-key-here
export STRIPE_SECRET_KEY=sk_test_your-key-here  # 可选

# 启动
node dev-server.js
# 访问 http://localhost:3000
```

### 测试 AI 生成功能
```bash
export OPENAI_API_KEY=sk-your-key-here
node test-generate.js
```

测试脚本会：
1. 验证 API Key 有效性
2. 调用 DALL-E 3 生成一张测试图片
3. 验证图片可访问

---

## 技术栈
- 前端: 纯 HTML/CSS/JS (零依赖)
- API: Vercel Serverless Functions (Node.js 18+)
- AI: OpenAI DALL-E 3 / DALL-E 2
- 支付: Stripe
- 部署: Vercel (免费套餐)
- 本地开发: Node.js dev-server.js

## 成本结构

| 项目 | 费用 |
|------|------|
| Vercel 托管 | 免费 |
| OpenAI API (DALL-E 3) | $0.04/张 |
| Stripe 支付 | 免费开通，2.9%+$0.30/笔 |
| 域名 (可选) | $0–$10/年 |
| **每月最低** | **$0 + 按量付费** |

## 变现策略

### 直接卖订阅 ($19–$149/月)
- 用户每月付费使用 AI 生成器
- 参考定价：Starter $19、Creator Pro $49、Enterprise $149

### 卖 AI 生成资产包 ($19–$89/套)
- 把 AI 生成的作品打包成模板上架
- 平台：Gumroad、Creative Market、Etsy

### 代运营服务 ($500–$3000/月)
- 用这个工具为客户批量生产内容
- 收服务费，成本几乎为零

## 盈利测算 (假设 Creator Pro $49/月)

| 客户数 | 月收入 | 月成本 (API) | 利润 |
|--------|--------|-------------|------|
| 1 | $49 | ~$2 | **$47** |
| 10 | $490 | ~$20 | **$470** |
| 50 | $2,450 | ~$100 | **$2,350** |
| 100 | $4,900 | ~$200 | **$4,700** |

第一个客户就回本。
