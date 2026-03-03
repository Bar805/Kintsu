# Chat Actions

## Purpose
Server actions for real-time messaging, conversation management, and archiving.

## Scope
- **In scope:** API contracts for message sending, fetching, conversation listing
- **Out of scope:** Real-time subscriptions (see [Supabase Patterns](../infrastructure/supabase-patterns.md))

## Dependencies
- [Message](../data-models/message.md), [Conversation](../data-models/conversation.md) for data models
- [Chat Messaging](../features/chat-messaging.md), [Timer System](../features/timer-system.md) for business logic

---

## sendMessage

### Signature
```typescript
async function sendMessage(
  conversationId: string,
  content: string,
  id?: string
): Promise<boolean>
```

### Input
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversationId` | string | Yes | Conversation UUID |
| `content` | string | Yes | Message text |
| `id` | string | No | Optimistic message ID (for UI confirmation) |

### Output
```typescript
boolean  // true if success, false if failed
```

### Business Rules
1. Verify user is participant (RLS check)
2. Check conversation is_active = true (reject if archived)
3. Insert message (sender_id = auth.uid(), is_ai_generated = false)
4. Update conversation metadata:
   - last_message_sender_id = sender
   - Add sender to user_ids_who_messaged
   - Clear timer if both users messaged
5. Trigger AI evaluation (non-blocking, catch errors)
6. Return true (even if AI fails)

### Error Responses
- User not authenticated → false
- User not participant → false
- Conversation archived → false
- Database error → false

### File Location
`app/actions/chat.ts`

---

## getMessages

### Signature
```typescript
async function getMessages(conversationId: string): Promise<Message[]>
```

### Input
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversationId` | string | Yes | Conversation UUID |

### Output
```typescript
Message[]  // Ordered by created_at ASC (oldest first)
```

### Business Rules
1. Verify user is participant (RLS enforced)
2. Fetch all messages for conversation
3. Order by created_at ASC
4. Return array (empty if no messages or not participant)

### File Location
`app/actions/chat.ts`

---

## getConversations

### Signature
```typescript
async function getConversations(): Promise<ConversationWithDetails[]>
```

### Input
None (uses authenticated user from session)

### Output
```typescript
ConversationWithDetails[]  // Ordered by created_at DESC

interface ConversationWithDetails {
  id: string
  created_at: string
  is_active: boolean
  timer_expires_at: string | null
  last_message_sender_id: string | null
  interested_user_ids: string[]
  meetup_suggested: boolean
  user_ids_who_messaged: string[]
  partner_name: string      // Enriched from profile
  partner_avatar: string    // Enriched from profile
}
```

### Business Rules
1. Get user's conversation IDs via participants table
2. Fetch conversation details with participants JOIN
3. Batch-fetch partner profiles for enrichment
4. Sort by created_at DESC (most recent first)
5. Return enriched array

### File Location
`app/actions/chat.ts`

---

## archiveExpiredConversations

### Signature
```typescript
async function archiveExpiredConversations(): Promise<number>
```

### Input
None

### Output
```typescript
number  // Count of archived conversations
```

### Business Rules
1. Use admin client (service role key)
2. Update conversations:
   - SET is_active = false
   - WHERE is_active = true
   - AND timer_expires_at IS NOT NULL
   - AND timer_expires_at < now()
3. Log archived conversation IDs
4. Return count

### Usage
Called by background cron job (every 5 minutes) or manual trigger.

### File Location
`app/actions/chat.ts`

---

## Acceptance Criteria

- [ ] sendMessage rejects if user not participant
- [ ] sendMessage rejects if conversation archived
- [ ] sendMessage updates user_ids_who_messaged
- [ ] sendMessage clears timer when both users messaged
- [ ] sendMessage triggers AI evaluation (non-blocking)
- [ ] getMessages ordered chronologically (oldest first)
- [ ] getConversations enriched with partner metadata
- [ ] archiveExpiredConversations uses admin client
- [ ] All functions handle authentication errors gracefully
