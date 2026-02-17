-- Match Requests table for the revamped matchmaker flow
-- Run this in Supabase SQL Editor

CREATE TABLE match_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'chatting'
        CHECK (status IN ('chatting', 'searching', 'pending_approval', 'accepted', 'declined', 'expired', 'no_candidates')),
    matched_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    declined_user_ids UUID[] DEFAULT '{}',
    conversation_history JSONB DEFAULT '[]',
    match_reason TEXT,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours')
);

-- Index for fast lookups
CREATE INDEX idx_match_requests_requester ON match_requests(requester_id, status);
CREATE INDEX idx_match_requests_matched ON match_requests(matched_user_id, status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_match_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER match_requests_updated_at
    BEFORE UPDATE ON match_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_match_request_timestamp();

-- RLS
ALTER TABLE match_requests ENABLE ROW LEVEL SECURITY;

-- Requester can see their own requests
CREATE POLICY "Users can view own match requests"
    ON match_requests FOR SELECT
    USING (auth.uid() = requester_id);

-- Matched user can see requests targeting them
CREATE POLICY "Matched users can view their pending requests"
    ON match_requests FOR SELECT
    USING (auth.uid() = matched_user_id AND status = 'pending_approval');

-- Requester can insert
CREATE POLICY "Users can create match requests"
    ON match_requests FOR INSERT
    WITH CHECK (auth.uid() = requester_id);

-- Requester can update their own chatting/searching requests
CREATE POLICY "Requester can update own requests"
    ON match_requests FOR UPDATE
    USING (auth.uid() = requester_id AND status IN ('chatting', 'searching'));

-- Matched user can update (accept/decline) pending requests
CREATE POLICY "Matched user can respond to pending requests"
    ON match_requests FOR UPDATE
    USING (auth.uid() = matched_user_id AND status = 'pending_approval');

-- Enable realtime for match_requests
ALTER PUBLICATION supabase_realtime ADD TABLE match_requests;
