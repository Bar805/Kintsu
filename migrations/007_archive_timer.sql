-- ============================================================================
-- Archive Timer Migration: user_ids_who_messaged tracking
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Track which users have sent at least one message in a conversation.
-- When both participant IDs are present, the timer clears and the chat is saved.
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS user_ids_who_messaged uuid[] DEFAULT '{}';
