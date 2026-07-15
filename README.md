# PixelForge AI Studio — 一键部署指南

一个可直接商用的 AI 内容创作 SaaS，5 分钟部署上线。

## 总成本

| 项目 | 费用 |
|------|------|
| Vercel 托管 | 免费 |
| OpenAI API (DALL-E 3) | $0.04–$0.08/张 |
| Stripe 支付 | 免费开通，2.9%+$0.30/笔 |
| 域名 (可选) | $0–$10/年 |
| **每月最低** | **$0 + 按量付费** |

## 部署步骤 (5 分钟)

### 1. 注册账号 (免费)
- [Vercel](https://vercel.com) — 用 GitHub 登录
- [OpenAI](https://platform.openai.com) — 获取 API Key

### 2. 准备项目
```bash
# 把项目目录推送到 GitHub
cd outputs/ai-studio
git init
git add .
git commit -m "init"
# 在 GitHub 新建仓库后：
git remote add origin https://github.com/你的用户名/pixelforge-ai.git
git push -u origin main
```

### 3. 部署到 Vercel
1. 打开 https://vercel.com/new
2. 导入刚才的 GitHub 仓库
3. 在环境变量中设置：
   - `OPENAI_API_KEY` = 你的 OpenAI API Key
   - `MODEL` = `dall-e-3` (或 `dall-e-2` 更便宜)
4. 点击 Deploy → 等 30 秒
5. 搞定！你的域名是 `https://项目名.vercel.app`

### 4. (可选) 接入 Stripe 收钱
1. 注册 [Stripe](https://dashboard.stripe.com)
2. 获取 Secret Key
3. 在 Vercel 添加环境变量 `STRIPE_SECRET_KEY`
4. 在 Stripe 后台创建产品：Starter ($19)、Creator Pro ($49)、Enterprise ($149)

## 变现策略

### 直接卖订阅 ($19–$149/月)
- 用户每月付费使用 AI 生成器
- 定价参考见首页定价区

### 卖 AI 生成资产包 ($19–$89/套)
- 把 AI 生成的作品打包成模板上架
- 平台：Gumroad、Creative Market、Etsy

### 代运营服务 ($500–$3000/月)
- 用这个工具为客户批量生产内容
- 收服务费，成本几乎为零

## 盈利测算

假设 Creator Pro ($49/月)：

| 客户数 | 月收入 | 月成本 (API) | 利润 |
|--------|--------|-------------|------|
| 1 | $49 | ~$2 | **$47** |
| 10 | $490 | ~$20 | **$470** |
| 50 | $2,450 | ~$100 | **$2,350** |
| 100 | $4,900 | ~$200 | **$4,700** |

第一个客户就回本。

## 技术栈
- 前端: 纯 HTML/CSS/JS (零依赖)
- API: Vercel Serverless Functions
- AI: OpenAI DALL-E 3/2
- 支付: Stripe
- 部署: Vercel (免费)
