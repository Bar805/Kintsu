# Supabase Patterns

## Purpose
Standard patterns for Supabase client usage, RLS, and real-time subscriptions.

## Scope
- **In scope:** Client types, RLS policies, real-time subscription patterns
- **Out of scope:** Database schema (see data-models/)

## Dependencies
- [Glossary](../shared/glossary.md) for RLS terminology
- [Conventions](../shared/conventions.md) for code patterns

---

## Client Types

### Regular Client (RLS Enforced)

**Purpose:** All user-facing operations

**Import:**
```typescript
// Browser
import { createClient } from '@/utils/supabase/client'

// Server
import { createClient } from '@/utils/supabase/server'
```

**Usage:**
```typescript
const supabase = await createClient()
const { data } = await supabase
  .from('messages')
  .select('*')
  .eq('conversation_id', conversationId)
// RLS policies apply
```

**Environment Variables:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

### Admin Client (RLS Bypassed)

**Purpose:** System operations (Trio messages, bulk updates, archiving)

**Import:**
```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
```

**Usage:**
```typescript
const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

await adminClient.from('messages').insert({
  sender_id: process.env.NEXT_PUBLIC_TRIO_USER_ID!,
  content: trioMessage,
  is_ai_generated: true
})
// RLS bypassed
```

**Environment Variables:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only!)

**When to Use:**
- Posting Trio messages (bypass participant RLS)
- Expiring match requests (bulk update)
- Archiving conversations (bulk update)
- Any operation needing elevated privileges

---

## Query Patterns

### Error Handling
```typescript
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single()

if (error) {
  console.error('Query failed:', error)
  return null
}

return data as Profile
```

### Batch Queries
```typescript
// Fetch multiple profiles efficiently
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, first_name, avatar_url')
  .in('id', userIds)  // Batch fetch

// Build map for O(1) lookup
const profileMap = new Map()
profiles?.forEach(p => profileMap.set(p.id, p))
```

---

## Real-time Subscriptions

### Messages Subscription
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        const newMessage = payload.new as Message
        setMessages(prev => [...prev, newMessage])
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [conversationId])
```

### Conversations Subscription
```typescript
useEffect(() => {
  const channel = supabase
    .channel('conversations')
    .on(
      'postgres_changes',
      {
        event: '*',  // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'conversations'
      },
      () => {
        refetch()  // Refresh conversation list
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [])
```

### Best Practices
1. Always clean up subscriptions in useEffect cleanup
2. Use specific filters to minimize events
3. One channel per conversation (don't share)
4. Handle reconnection automatically (Supabase handles this)

---

## RLS Policy Patterns

### Read-All, Write-Own
```sql
-- Profiles: anyone can read, users update own
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

### Participant-Based Access
```sql
-- Messages: users access only their conversation messages
CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM participants
      WHERE participants.conversation_id = messages.conversation_id
      AND participants.user_id = auth.uid()
    )
  );
```

### State-Based Access
```sql
-- Match requests: matched user sees pending requests only
CREATE POLICY "Matched users can view pending requests"
  ON match_requests FOR SELECT
  USING (
    auth.uid() = matched_user_id
    AND status = 'pending_approval'
  );
```

---

## Acceptance Criteria

- [ ] Regular client used for all user operations
- [ ] Admin client used only for system operations (documented with comment)
- [ ] All queries check for errors before accessing data
- [ ] Real-time subscriptions cleaned up in useEffect
- [ ] Specific filters used in real-time subscriptions
- [ ] RLS policies enforce participant-only access
