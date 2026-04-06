-- Add error handling to match_requests table
-- This migration adds support for error states and error messages

-- 1. Add error_message field
ALTER TABLE match_requests
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 2. Update status constraint to include 'error' state
ALTER TABLE match_requests
DROP CONSTRAINT match_requests_status_check;

ALTER TABLE match_requests
ADD CONSTRAINT match_requests_status_check
CHECK (status IN ('chatting', 'searching', 'pending_approval', 'accepted', 'declined', 'expired', 'no_candidates', 'error'));

-- 3. Update RLS policy to allow users to delete their error requests
CREATE POLICY "Users can delete error requests"
    ON match_requests FOR DELETE
    USING (auth.uid() = requester_id AND status = 'error');

-- Note: Service role (admin client) already has full access for error management
