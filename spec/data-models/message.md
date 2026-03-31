# Message Data Model

## Purpose
Individual chat messages in a conversation. Supports both user and AI-generated messages.

## Scope
- **In scope:** Schema, fields, AI vs user messages
- **Out of scope:** Message sending logic (see [Chat Actions](../api/chat-actions.md)), real-time delivery (see [Supabase Patterns](../infrastructure/supabase-patterns.md))

## Dependencies
- [Glossary](../shared/glossary.md) for domain terms
- [Conversation](./conversation.md) for parent entity

---

## Schema

### Table: `messages`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Message ID |
| `conversation_id` | UUID | FK to conversations(id) ON DELETE CASCADE, NOT NULL | Parent conversation |
| `sender_id` | UUID | FK to auth.users(id) ON DELETE CASCADE, NOT NULL | User or Trio system user |
| `content` | text | NOT NULL | Message text content |
| `created_at` | timestamptz | NOT NULL, default now() | Send timestamp |
| `is_ai_generated` | boolean | NOT NULL, default false | True if from Trio, false if user |
| `thought_id` | UUID | FK to trio_thoughts(id) ON DELETE SET NULL, nullable | Thought that produced this message (if AI) |
| `thought_category` | text | nullable | Category of thought (for analytics) |
| `motivation_score` | numeric(3,2) | nullable | Motivation score of selected thought |

### Indexes
```sql
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_thought ON messages(thought_id) WHERE thought_id IS NOT NULL;
```

### RLS Policies
```sql
-- Users can view messages in their conversations
CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM participants
      WHERE participants.conversation_id = messages.conversation_id
      AND participants.user_id = auth.uid()
    )
  );

-- Users can insert messages in their conversations
CREATE POLICY "Users can send messages in own conversations"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM participants
      WHERE participants.conversation_id = messages.conversation_id
      AND participants.user_id = auth.uid()
    )
  );
```

---

## Field Details

### Sender Identification
- **sender_id:**
  - User message: UUID of authenticated user
  - Trio message: `process.env.NEXT_PUBLIC_TRIO_USER_ID` (special system user)

- **is_ai_generated:**
  - `true`: Message from Trio (interjection or meetup suggestion)
  - `false`: Message from user

### Content Encoding
- **content:** Plain text. Special format for meetup suggestions:
  ```
  {message text}

  [MEETUP_PLACES]{json}[/MEETUP_PLACES]
  ```

  Example:
  ```
  You two should check out Rock Climb Fairfield and grab ramen after!

  [MEETUP_PLACES][{"name":"Rock Climb Fairfield","category":"gym","googleMapsUri":"..."}][/MEETUP_PLACES]
  ```

---

## Business Rules

1. **User messages:**
   - Must be participant of conversation (enforced by RLS)
   - `sender_id = auth.uid()`
   - `is_ai_generated = false`

2. **Trio messages:**
   - Posted via admin client (bypasses RLS)
   - `sender_id = NEXT_PUBLIC_TRIO_USER_ID`
   - `is_ai_generated = true`
   - `thought_id`, `thought_category`, `motivation_score` populated from selected thought

3. **Ordering:** Messages ordered by `created_at ASC` (oldest first)

4. **Deletion:** Cascade delete when conversation deleted

5. **Content length:** No enforced limit (PostgreSQL text type)

---

## Message Types

| Type | sender_id | is_ai_generated | thought_id | RLS Client |
|------|-----------|-----------------|------------|------------|
| User message | User UUID | false | NULL | Regular (RLS enforced) |
| Trio interjection | TRIO_USER_ID | true | UUID | Admin (RLS bypassed) |
| Meetup suggestion | TRIO_USER_ID | true | UUID | Admin (RLS bypassed) |
| Match intro | TRIO_USER_ID | true | NULL | Admin (RLS bypassed) |

---

## Acceptance Criteria

- [ ] User messages inserted via regular client (RLS enforced)
- [ ] Trio messages inserted via admin client with TRIO_USER_ID
- [ ] is_ai_generated correctly distinguishes user vs AI messages
- [ ] Meetup suggestions include [MEETUP_PLACES] JSON payload in content
- [ ] Messages ordered chronologically (created_at ASC)
- [ ] RLS policies prevent cross-conversation message access
