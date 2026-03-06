-- ============================================================
-- Trio Identity Stack Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add Vibe Sliders (psychographic traits, stored as JSONB)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sliders jsonb
    DEFAULT '{"social_battery":50,"planning":50,"conversation":50,"thinking":50,"risk":50}';

-- 2. Add Identity Chips (exactly 3 string tags)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS identity_chips text[]
    DEFAULT '{}';

-- 3. Add Prompt Answer (stores which prompt was chosen + the user's answer)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS prompt_answer jsonb
    DEFAULT '{}';

-- 4. Add AI-generated summary (editable by user)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_summary text
    DEFAULT '';

-- ============================================================
-- Optional cleanup: drop retired columns if you no longer need them.
-- Uncomment the lines below ONLY if you are sure you want to remove them.
-- ============================================================
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS interests;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS bio;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS looking_for;
