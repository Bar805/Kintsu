# Suggestion Actions

## Purpose
Server actions for interest tracking and meetup suggestion generation.

## Scope
- **In scope:** API contracts for markInterested, generateMeetupSuggestion, getConversationMeta
- **Out of scope:** UI components (see features)

## Dependencies
- [Interest Tracking](../features/interest-tracking.md) for business logic
- [Meetup Suggestions](../features/meetup-suggestions.md) for pipeline
- [Conversation](../data-models/conversation.md) for data model

---

## markInterested

### Signature
```typescript
async function markInterested(
  conversationId: string
): Promise<{ interested: boolean }>
```

### Input
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversationId` | string | Yes | Conversation UUID |

### Output
```typescript
{
  interested: boolean  // true if now interested, false if toggled off
}
```

### Business Rules
1. Toggle user's interested status (add/remove from interested_user_ids)
2. If both users interested AND `meetup_suggested = false`:
   - Set `meetup_suggested = true`
   - Call `generateMeetupSuggestion()` in background
3. If user toggles off before meetup sent, clear trigger
4. Return current interested status

### File Location
`app/actions/chat-suggestions.ts`

---

## generateMeetupSuggestion

### Signature
```typescript
async function generateMeetupSuggestion(
  conversationId: string
): Promise<MeetupSuggestion | null>
```

### Input
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversationId` | string | Yes | Conversation UUID |

### Output
```typescript
MeetupSuggestion | null

interface MeetupSuggestion {
  message: string       // Warm message from Trio
  places: MeetupPlace[]
}

interface MeetupPlace {
  name: string
  category: string
  mapsQuery: string
  googleMapsUri: string
  address: string
}
```

### Business Rules
1. **Stage 1:** Extract 2 search queries + location context (Gemini)
2. **Stage 2:** Resolve venues via Google Places API (top result per query)
3. **Stage 3:** Synthesize message with ONLY verified venues (Gemini)
4. Return `null` if < 1 venue resolved or any stage fails
5. Post Trio message with `[MEETUP_PLACES]` JSON payload
6. Set `meetup_suggested = true` in conversation

### File Location
`app/actions/chat-suggestions.ts`

---

## getConversationMeta

### Signature
```typescript
async function getConversationMeta(
  conversationId: string
): Promise<ConversationMeta>
```

### Input
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversationId` | string | Yes | Conversation UUID |

### Output
```typescript
interface ConversationMeta {
  timerExpiresAt: string | null
  isInterested: boolean           // Current user's status
  meetupSuggested: boolean
  isActive: boolean
  userIdsWhoMessaged: string[]
}
```

### Business Rules
1. Fetch conversation metadata
2. Check if current user in `interested_user_ids`
3. Return safe defaults if conversation not found (don't throw)

### File Location
`app/actions/chat-suggestions.ts`

---

## Acceptance Criteria

- [ ] markInterested toggles user status correctly
- [ ] markInterested triggers meetup when both interested
- [ ] generateMeetupSuggestion runs 3-stage RAG pipeline
- [ ] generateMeetupSuggestion returns null if < 1 venue
- [ ] getConversationMeta returns safe defaults on error
- [ ] All functions use admin client for conversation updates
