-- ============================================================================
-- Chat Features Migration: Timer, Interest Tracking
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Add timer & interest columns to conversations
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS timer_expires_at timestamptz DEFAULT (now() + interval '24 hours'),
ADD COLUMN IF NOT EXISTS last_message_sender_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS interested_user_ids uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS meetup_suggested boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS meetup_trigger_after integer DEFAULT null;

-- 2. Enable realtime for conversations table (for timer/interest updates)
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- 3. Update existing conversations to have a timer
UPDATE conversations
SET timer_expires_at = now() + interval '24 hours'
WHERE timer_expires_at IS NULL;
