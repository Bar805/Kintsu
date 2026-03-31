# Coding Conventions

## Purpose
Shared coding standards for all Kintsu code. Reference this for naming, patterns, and style rules.

## Scope
- **In scope:** TypeScript, file organization, naming, error handling, database patterns, AI patterns
- **Out of scope:** UI/UX design decisions (see feature specs)

## Dependencies
- [Glossary](./glossary.md) for domain terms

---

## TypeScript Standards

### Strict Mode
- ✅ Enabled: `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`
- ❌ Forbidden: `any` type (use `unknown`), `@ts-ignore` without comment

### Type Declarations
```typescript
// ✅ Explicit types
async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').single()
  if (error) return null
  return data as Profile
}

// ❌ Implicit types
async function getProfile(userId) {
  return await supabase.from('profiles').select('*').single()
}
```

---

## File Organization

| File Type | Convention | Example |
|-----------|------------|---------|
| Components | PascalCase | `ChatWindow.tsx` |
| Server Actions | kebab-case | `matchmaker.ts` |
| Utilities | kebab-case | `supabase/client.ts` |
| Interfaces | PascalCase | `interface UserProfile` |
| Constants | SCREAMING_SNAKE | `TRIO_CONFIG` |
| Variables | camelCase | `const userId = ...` |

### Directives
```typescript
// Server actions (top of file)
'use server'

// Client components (top of file)
'use client'
```

---

## Error Handling

### Server Actions
```typescript
// ✅ Return boolean/null for errors
export async function sendMessage(...): Promise<boolean> {
  try {
    const { error } = await supabase.from('messages').insert(...)
    if (error) {
      console.error('Error sending message:', error)
      return false
    }
    return true
  } catch (e) {
    console.error('Unexpected error:', e)
    return false
  }
}

// ❌ Throw errors to client
export async function sendMessage(...): Promise<void> {
  const { error } = await supabase.from('messages').insert(...)
  if (error) throw new Error('Failed')  // Leaks internals!
}
```

### Client Components
```typescript
// ✅ User-friendly feedback
const success = await sendMessage(conversationId, text)
if (!success) {
  toast.error('Failed to send message. Please try again.')
  return
}
```

---

## Database Patterns

### Client Types
```typescript
// Regular client (RLS enforced) — user operations
const supabase = await createClient()

// Admin client (RLS bypassed) — system operations
const admin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
```

### Query Patterns
```typescript
// ✅ Check errors, type-cast
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

// ❌ No error check
const { data } = await supabase.from('profiles').select('*').single()
return data  // Error and type ignored!
```

### Real-time Subscriptions
```typescript
// ✅ Cleanup in useEffect
useEffect(() => {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', { ... }, handler)
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [conversationId])
```

---

## AI Integration Patterns

### Retry Logic (Exponential Backoff)
```typescript
for (let attempt = 0; attempt < 3; attempt++) {
  const response = await fetch(geminiUrl, { ... })

  if (response.status === 429) {
    const wait = Math.pow(2, attempt + 1) * 1000  // 2s, 4s, 8s
    console.log(`Gemini rate limited (attempt ${attempt + 1}/3), retrying in ${wait}ms`)
    await new Promise(r => setTimeout(r, wait))
    continue
  }

  if (!response.ok) throw new Error(`API Error: ${response.status}`)
  return await response.text()
}

throw new Error('Rate limited after 3 retries')
```

### Structured JSON Outputs
```typescript
const schema = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    readyToSearch: { type: "BOOLEAN" }
  },
  required: ["reply", "readyToSearch"]
}

const raw = await callGemini(systemPrompt, history, schema)
const sanitized = raw.replace(/"(?:[^"\\]|\\.)*"/g, m => m.replace(/\n/g, '\\n'))
const parsed = JSON.parse(sanitized)

// Validate before use
if (!parsed.reply || typeof parsed.readyToSearch !== 'boolean') {
  throw new Error('Invalid AI response')
}
```

### Console Logging
```typescript
// ✅ Prefixed logs
console.log('[matchmaker] raw Gemini response:', text)
console.log('[ai] Trio Judge Result:', { score, reason })
console.error('[suggestions] Stage 1 failed:', error)

// ❌ Generic logs
console.log('Response:', text)
```

---

## Security Standards

### Authentication
```typescript
// ✅ Verify user in all server actions
export async function sendMessage(...): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return false
  // Proceed with authenticated user
}
```

### Environment Variables
```typescript
// ✅ Use process.env
const apiKey = process.env.GOOGLE_API_KEY  // Server-only
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL  // Client-accessible

// ❌ Hardcoded secrets
const apiKey = 'AIzaSy...'  // Never!
```

---

## Forbidden Patterns

1. ❌ `any` type
2. ❌ `@ts-ignore` without comment
3. ❌ Inline styles (use Tailwind)
4. ❌ CSS files (use Tailwind)
5. ❌ Custom auth logic (use Supabase Auth)
6. ❌ Hardcoded secrets
7. ❌ Throwing errors to client
8. ❌ Blocking AI calls
9. ❌ Magic numbers (use named constants)
10. ❌ Direct database access (use Supabase client)

---

## Import Order
1. React / Next.js
2. Third-party libraries
3. Internal utilities (`@/utils/`)
4. Type definitions (`@/types/`)
5. Components (`@/components/`)
6. Relative imports

```typescript
import { useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/types/database'
import { ChatWindow } from '@/components/ChatWindow'
import { TRIO_CONFIG } from '../lib/trio-config'
```

---

## Function Documentation

```typescript
/**
 * Sends a message in a conversation and triggers AI evaluation.
 *
 * @param conversationId - UUID of the conversation
 * @param content - Message text content
 * @returns true if successful, false otherwise
 *
 * Business Rules:
 * - User must be participant
 * - Conversation must be active
 * - Timer clears when both users message
 */
export async function sendMessage(
  conversationId: string,
  content: string
): Promise<boolean> {
  // ...
}
```

---

## Git Commits

Format: `<type>: <description>`

Types: `feat`, `fix`, `refactor`, `style`, `docs`, `test`, `chore`

```
feat: implement 3-stage RAG pipeline for meetup suggestions
fix: prevent partner bio leak in icebreaker suggestions
refactor: extract message sending logic to custom hook
```