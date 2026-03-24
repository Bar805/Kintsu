-- Add intro_message column to match_requests table
-- This stores the AI-generated introduction message for when the match is accepted
-- Run this in Supabase SQL Editor

ALTER TABLE match_requests
ADD COLUMN intro_message TEXT;

COMMENT ON COLUMN match_requests.intro_message IS 'AI-generated introduction message to be posted when match is accepted';
