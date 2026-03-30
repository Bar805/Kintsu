-- ============================================================================
-- Modify Existing Tables: Add cognitive system fields
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. messages: Add thought tracking fields
-- ============================================================================
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS thought_id uuid REFERENCES trio_thoughts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS thought_category text,
ADD COLUMN IF NOT EXISTS motivation_score numeric(3,2);

-- Index for thought lookups
CREATE INDEX IF NOT EXISTS idx_messages_thought ON messages(thought_id) WHERE thought_id IS NOT NULL;

-- ============================================================================
-- 2. profiles: Add embedding fields for semantic search
-- ============================================================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS interests_embeddings vector(768)[],
ADD COLUMN IF NOT EXISTS bio_embedding vector(768);

-- Index for bio embedding search
CREATE INDEX IF NOT EXISTS idx_profiles_bio_embedding ON profiles
  USING ivfflat (bio_embedding vector_cosine_ops) WITH (lists = 100);
