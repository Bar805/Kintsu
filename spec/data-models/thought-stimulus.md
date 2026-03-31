# Thought Stimulus Data Model

## Purpose
Tracks which inputs inspired each System 2 thought. Provides explainability and auditability for Trio's cognitive process.

## Scope
- **In scope:** Schema, stimulus types, saliency tracking
- **Out of scope:** Stimulus generation logic (see [ADAPTATION_PLAN.md](../ai_mediator_flow/ADAPTATION_PLAN.md))

## Dependencies
- [Glossary](../shared/glossary.md) for domain terms
- [Trio Thought](./trio-thought.md) for parent entity
- [Interest Saliency](./interest-saliency.md), [Message Memory](./message-memory.md) for stimulus sources

---

## Schema

### Table: `thought_stimuli`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Stimulus link ID |
| `thought_id` | UUID | FK to trio_thoughts(id) ON DELETE CASCADE, NOT NULL | Parent thought |
| `stimulus_type` | enum | NOT NULL, CHECK IN ('interest', 'message', 'previous_thought', 'profile_bio') | Type of input |
| `stimulus_ref_id` | UUID | nullable | Foreign key to relevant table |
| `stimulus_text` | text | nullable | Text excerpt of the stimulus (for display) |
| `saliency_score` | numeric(4,3) | NOT NULL | Relevance score at time of thought generation |

### Indexes
```sql
CREATE INDEX idx_thought_stimuli_thought ON thought_stimuli(thought_id);
CREATE INDEX idx_thought_stimuli_type ON thought_stimuli(stimulus_type);
```

### RLS Policies
```sql
-- Users can view stimuli for thoughts in their conversations
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
```

---

## Field Details

### Stimulus Types

| Type | stimulus_ref_id | stimulus_text | Description |
|------|-----------------|---------------|-------------|
| `interest` | interest_saliency.id | "hiking" | User interest from profile |
| `message` | message_memory.id | "I love East Rock trail" | Recent conversation message |
| `previous_thought` | trio_thoughts.id | "Both users outdoor enthusiasts" | Prior thought Trio had |
| `profile_bio` | profiles.id | "Adventure seeker..." | User bio text |

### Saliency Score
- **Range:** 0.000 to 2.000+ (typically 0.0-1.0)
- **Snapshot:** Captured at moment of thought generation (immutable)
- **Purpose:** Shows how relevant this stimulus was when Trio had the thought
- **Higher scores:** More influence on thought generation

### Reference IDs
- **interest:** Points to `interest_saliency.id` (conversation-specific interest record)
- **message:** Points to `message_memory.id` (memory record, not raw message)
- **previous_thought:** Points to `trio_thoughts.id` (earlier thought in same conversation)
- **profile_bio:** Points to `profiles.id` (user profile)

---

## Business Rules

1. **System Type:**
   - **System 1 thoughts:** NO stimuli (intuitive, fast reactions)
   - **System 2 thoughts:** 2-5 stimuli per thought (deliberate, memory-based)

2. **Stimulus Selection:**
   - Top 5 salient interests (sorted by `saliency_score DESC`)
   - Top 3 salient previous thoughts
   - Last 5 messages from memory
   - User bios (if bio_embedding similarity high)

3. **Immutability:**
   - Once created, stimuli records never updated
   - Saliency score is snapshot (not live value)
   - Enables historical analysis of why Trio had a thought

4. **Cascade Deletion:**
   - If thought deleted, all stimuli deleted (CASCADE)
   - If stimulus source deleted (e.g., message), stimulus remains with NULL ref_id

---

## Example Data

**Thought with Multiple Stimuli:**

Thought: "Both users love hiking - East Rock is perfect for a first meetup"

```json
[
  {
    "id": "stim-001",
    "thought_id": "thought-123",
    "stimulus_type": "interest",
    "stimulus_ref_id": "int-sal-456",
    "stimulus_text": "hiking",
    "saliency_score": 0.92
  },
  {
    "id": "stim-002",
    "thought_id": "thought-123",
    "stimulus_type": "message",
    "stimulus_ref_id": "mem-789",
    "stimulus_text": "User A: I love the East Rock trail!",
    "saliency_score": 1.0
  },
  {
    "id": "stim-003",
    "thought_id": "thought-123",
    "stimulus_type": "interest",
    "stimulus_ref_id": "int-sal-457",
    "stimulus_text": "outdoor activities",
    "saliency_score": 0.85
  }
]
```

---

## Use Cases

### 1. Explainability Dashboard
Show users why Trio said something:
```sql
SELECT
  ts.stimulus_type,
  ts.stimulus_text,
  ts.saliency_score
FROM thought_stimuli ts
JOIN trio_thoughts t ON t.id = ts.thought_id
WHERE t.articulated_message_id = ?
ORDER BY ts.saliency_score DESC;
```

### 2. Stimuli Pattern Analysis
Identify most influential stimulus types:
```sql
SELECT
  stimulus_type,
  COUNT(*) AS usage_count,
  AVG(saliency_score) AS avg_saliency
FROM thought_stimuli ts
JOIN trio_thoughts t ON t.id = ts.thought_id
WHERE t.was_selected = true
GROUP BY stimulus_type
ORDER BY usage_count DESC;
```

### 3. Interest Coverage
Which interests most frequently inspire thoughts:
```sql
SELECT
  stimulus_text AS interest,
  COUNT(*) AS thought_count,
  AVG(saliency_score) AS avg_saliency
FROM thought_stimuli
WHERE stimulus_type = 'interest'
GROUP BY stimulus_text
ORDER BY thought_count DESC
LIMIT 10;
```

---

## Acceptance Criteria

- [ ] Only System 2 thoughts have stimuli records
- [ ] Each System 2 thought has 2-5 stimuli
- [ ] Saliency scores are immutable snapshots (not live values)
- [ ] All 4 stimulus types (interest, message, previous_thought, profile_bio) supported
- [ ] RLS prevents viewing stimuli from other conversations
- [ ] stimulus_ref_id correctly points to source table based on type
- [ ] Cascade delete when parent thought deleted
