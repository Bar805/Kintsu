-- ============================================================================
-- Cognitive AI Mediator Tables: Dual-Process Thought System
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. trio_thoughts: Store all thoughts Trio generates (selected and unselected)
-- ============================================================================
CREATE TABLE IF NOT EXISTS trio_thoughts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  trigger_message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  system_type system_type NOT NULL,
  category text NOT NULL,
  content text NOT NULL,
  motivation_score numeric(3,2) NOT NULL CHECK (motivation_score >= 1.0 AND motivation_score <= 5.0),
  base_score numeric(3,2) NOT NULL,
  evaluation_reasoning text,
  was_selected boolean NOT NULL DEFAULT false,
  articulated_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for trio_thoughts
CREATE INDEX idx_trio_thoughts_conversation ON trio_thoughts(conversation_id, created_at DESC);
CREATE INDEX idx_trio_thoughts_selected ON trio_thoughts(was_selected) WHERE was_selected = true;
CREATE INDEX idx_trio_thoughts_trigger ON trio_thoughts(trigger_message_id);

-- RLS for trio_thoughts: Users can view thoughts from their conversations
ALTER TABLE trio_thoughts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view thoughts in own conversations"
  ON trio_thoughts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM participants
      WHERE participants.conversation_id = trio_thoughts.conversation_id
      AND participants.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 2. thought_stimuli: Track which inputs inspired each System 2 thought
-- ============================================================================
CREATE TABLE IF NOT EXISTS thought_stimuli (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  thought_id uuid NOT NULL REFERENCES trio_thoughts(id) ON DELETE CASCADE,
  stimulus_type stimulus_type NOT NULL,
  stimulus_ref_id uuid,
  stimulus_text text,
  saliency_score numeric(4,3) NOT NULL
);

-- Indexes for thought_stimuli
CREATE INDEX idx_thought_stimuli_thought ON thought_stimuli(thought_id);
CREATE INDEX idx_thought_stimuli_type ON thought_stimuli(stimulus_type);

-- RLS for thought_stimuli: Users can view stimuli for thoughts in their conversations
ALTER TABLE thought_stimuli ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stimuli in own conversations"
  ON thought_stimuli FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trio_thoughts t
      JOIN participants p ON p.conversation_id = t.conversation_id
      WHERE t.id = thought_stimuli.thought_id
      AND p.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. interest_saliency: Dynamic relevance scores for user interests
-- ============================================================================
CREATE TABLE IF NOT EXISTS interest_saliency (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  interest_text text NOT NULL,
  saliency_score numeric(4,3) NOT NULL DEFAULT 0.5,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  embedding vector(768) NOT NULL
);

-- Composite unique constraint
CREATE UNIQUE INDEX idx_interest_saliency_unique
  ON interest_saliency(conversation_id, user_id, interest_text);

-- Indexes for interest_saliency
CREATE INDEX idx_interest_saliency_conversation ON interest_saliency(conversation_id, saliency_score DESC);
CREATE INDEX idx_interest_saliency_user ON interest_saliency(user_id);
CREATE INDEX idx_interest_saliency_embedding ON interest_saliency
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS for interest_saliency: Users can view saliency in their conversations
ALTER TABLE interest_saliency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view interest saliency in own conversations"
  ON interest_saliency FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM participants
      WHERE participants.conversation_id = interest_saliency.conversation_id
      AND participants.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. message_memory: Short-term memory of recent messages with interpretations
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_memory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
  interpretation text NOT NULL,
  saliency_score numeric(4,3) NOT NULL DEFAULT 1.0,
  embedding vector(768) NOT NULL,
  last_updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for message_memory
CREATE INDEX idx_message_memory_conversation ON message_memory(conversation_id, last_updated_at DESC);
CREATE INDEX idx_message_memory_message ON message_memory(message_id);
CREATE INDEX idx_message_memory_embedding ON message_memory
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS for message_memory: Users can view memory from their conversations
ALTER TABLE message_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view message memory in own conversations"
  ON message_memory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM participants
      WHERE participants.conversation_id = message_memory.conversation_id
      AND participants.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Enable realtime for cognitive tables
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE trio_thoughts;
ALTER PUBLICATION supabase_realtime ADD TABLE interest_saliency;
