# Error Handling

## Purpose
Standard error handling patterns for server actions and AI calls.

## Scope
- **In scope:** Error response patterns, logging conventions
- **Out of scope:** UI error display (implementation detail)

## Dependencies
- [Conventions](../shared/conventions.md) for patterns

---

## Server Action Error Pattern

### Return Error Values (Not Throw)

```typescript
// ✅ GOOD
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

// ❌ BAD - Don't throw to client
export async function sendMessage(...): Promise<void> {
  const { error } = await supabase.from('messages').insert(...)
  if (error) throw new Error('Failed')  // Leaks internals
}
```

### Why?
- Prevents internal error details from leaking to client
- Easier for client to handle (boolean vs try/catch)
- Consistent API across all actions

---

## AI Call Error Pattern

### Non-blocking AI
```typescript
// AI should never block user operations
try {
  const shouldSpeak = await evaluateConversationState(...)
  if (shouldSpeak) await generateTrioResponse(...)
} catch (e) {
  console.error('AI trigger error:', e)
  // Continue - user message still succeeds
}
```

### User-facing AI
```typescript
// Graceful fallback for user-facing AI
try {
  const parsed = JSON.parse(response)
  return { reply: parsed.reply }
} catch (error) {
  console.error('AI error:', error)
  return { reply: "I'm having a moment — try again?" }
}
```

---

## Logging Conventions

### Prefixes
| Feature | Prefix | Example |
|---------|--------|---------|
| Matchmaker | `[matchmaker]` | `console.log('[matchmaker] raw response:', text)` |
| AI Interjections | `[ai]` | `console.log('[ai] Trio Judge Result:', score)` |
| Meetup Suggestions | `[suggestions]` | `console.log('[suggestions] Stage 1:', result)` |
| Places API | `[places-api]` | `console.error('[places-api] HTTP error:', status)` |

### Levels
- `console.log` — Info, debug messages
- `console.error` — Errors, failures

---

## Client Error Display

### Toast Notifications
```typescript
const success = await sendMessage(conversationId, text)
if (!success) {
  toast.error('Failed to send message. Please try again.')
  return
}
toast.success('Message sent!')
```

---

## Acceptance Criteria

- [ ] Server actions return error values (boolean/null), not throw
- [ ] All errors logged with context
- [ ] AI errors don't block user operations
- [ ] User-facing AI has graceful fallback messages
- [ ] Console logs use feature prefixes
