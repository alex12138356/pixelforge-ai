-- ============================================================
-- PixelForge AI Studio — Supabase 数据库 Schema
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================================

-- 用户表
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  stripe_customer_id TEXT UNIQUE,
  subscription_plan TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'inactive',
  generations_used INTEGER DEFAULT 0,
  generations_limit INTEGER DEFAULT 3,  -- 免费用户每月 3 次
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 生成记录表 (用于追踪每次 AI 生成)
CREATE TABLE IF NOT EXISTS public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  style TEXT,
  type TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 启用 Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- RLS 策略: 用户只能看到自己的数据
CREATE POLICY "users_view_own" ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "generations_view_own" ON public.generations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "generations_insert_own" ON public.generations
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- 套餐限额配置
CREATE TABLE IF NOT EXISTS public.plans (
  name TEXT PRIMARY KEY,
  generations_limit INTEGER NOT NULL,
  price_monthly INTEGER,  -- 美分
  stripe_price_id TEXT
);

INSERT INTO public.plans (name, generations_limit, price_monthly) VALUES
  ('free', 3, 0),
  ('starter', 50, 1900),
  ('creator', 200, 4900),
  ('enterprise', 999999, 14900)
ON CONFLICT (name) DO NOTHING;
