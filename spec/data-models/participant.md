# Participant Data Model

## Purpose
Junction table linking users to conversations (many-to-many relationship).

## Scope
- **In scope:** Schema, participant membership
- **Out of scope:** Conversation creation (see [Chat Actions](../api/chat-actions.md))

## Dependencies
- [Conversation](./conversation.md) for parent entity
- [Glossary](../shared/glossary.md) for domain terms

---

## Schema

### Table: `participants`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `conversation_id` | UUID | PK, FK to conversations(id) ON DELETE CASCADE | Conversation ID |
| `user_id` | UUID | PK, FK to auth.users(id) ON DELETE CASCADE | User ID |
| `joined_at` | timestamptz | NOT NULL, default now() | Membership timestamp |

**Composite Primary Key:** `(conversation_id, user_id)`

### Indexes
```sql
CREATE INDEX idx_participants_user ON participants(user_id);
CREATE INDEX idx_participants_conversation ON participants(conversation_id);
```

### RLS Policies
```sql
-- Users can view participants in their conversations
CREATE POLICY "Users can view participants in own conversations"
  ON participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM participants p2
      WHERE p2.conversation_id = participants.conversation_id
      AND p2.user_id = auth.uid()
    )
  );
```

---

## Business Rules

1. **Participant Count:** Conversations must have exactly 2 participants (not enforced at DB level, enforced in app logic).

2. **Immutable:** Once added, participants cannot be removed (no DELETE policy).

3. **Conversation Discovery:** Users find conversations via participants table:
   ```sql
   SELECT conversation_id FROM participants WHERE user_id = auth.uid()
   ```

4. **Partner Identification:** Find conversation partner:
   ```sql
   SELECT user_id FROM participants
   WHERE conversation_id = ?
   AND user_id != auth.uid()
   ```

5. **Cascade Delete:** If user deletes account, all their participations are removed.

---

## Usage Patterns

### Creating Conversation
```typescript
// 1. Create conversation
const { data: conversation } = await supabase
  .from('conversations')
  .insert({ is_active: true, timer_expires_at: ... })
  .select()
  .single()

// 2. Add both participants
await supabase
  .from('participants')
  .insert([
    { conversation_id: conversation.id, user_id: requester_id },
    { conversation_id: conversation.id, user_id: matched_user_id }
  ])
```

### Finding User's Conversations
```typescript
// 1. Get conversation IDs
const { data: userConversations } = await supabase
  .from('participants')
  .select('conversation_id')
  .eq('user_id', user.id)

const conversationIds = userConversations.map(uc => uc.conversation_id)

// 2. Fetch conversation details
const { data: conversations } = await supabase
  .from('conversations')
  .select('*')
  .in('id', conversationIds)
```

### Verifying Membership
```typescript
// Check if user is participant (used in sendMessage)
const { data: membership } = await supabase
  .from('participants')
  .select('user_id')
  .eq('conversation_id', conversationId)
  .eq('user_id', user.id)
  .single()

if (!membership) {
  return false  // Not a participant
}
```

---

## Acceptance Criteria

- [ ] Composite primary key prevents duplicate participations
- [ ] Conversations have exactly 2 participants (enforced in app logic)
- [ ] RLS allows viewing participants only in own conversations
- [ ] Cascade delete removes participations when user/conversation deleted
- [ ] joined_at timestamp records membership time
