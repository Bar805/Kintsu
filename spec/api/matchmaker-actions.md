# Matchmaker Actions

## Purpose
Server actions for matchmaking flow: conversational discovery, candidate selection, match approval.

## Scope
- **In scope:** API contracts (input/output), business rules, error responses
- **Out of scope:** Implementation details, UI integration

## Dependencies
- [MatchRequest](../data-models/match-request.md) for data model
- [Matchmaking Flow](../features/matchmaking-flow.md) for business logic
- [Conventions](../shared/conventions.md) for patterns

---

## chatWithMatchmaker

### Purpose
Handle conversational phase where Kintsu asks discovery questions.

### Signature
```typescript
async function chatWithMatchmaker(
  userMessage: string,
  requestId?: string
): Promise<{
  reply: string
  readyToSearch: boolean
  requestId: string
}>
```

### Input
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userMessage` | string | Yes | User's message describing preferences |
| `requestId` | string | No | Existing match request ID (created if omitted) |

### Output
```typescript
{
  reply: string           // Kintsu's response
  readyToSearch: boolean  // true if ready to search (3rd reply)
  requestId: string       // Match request ID
}
```

### Business Rules
1. Create new match_request if `requestId` not provided
2. Append user message to `conversation_history`
3. Call Gemini with Kintsu system prompt + history
4. Append AI reply to `conversation_history`
5. Safety net: if AI reply count >= 3, force `readyToSearch = true`
6. If `readyToSearch = true`, transition to `searching` and call `findMatch()` in background

### Error Response
```typescript
{
  reply: "I'm having a moment — try again?",
  readyToSearch: false,
  requestId: string
}
```

### File Location
`app/actions/matchmaker.ts`

---

## findMatch

### Purpose
Evaluate candidate profiles and select best match using AI.

### Signature
```typescript
async function findMatch(requestId: string): Promise<void>
```

### Input
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `requestId` | string | Yes | Match request ID in 'searching' state |

### Output
None (updates match_request in database)

### Business Rules
1. Load match_request by ID (must be in `searching` state)
2. Build exclusion list:
   - `requester_id` (self)
   - Existing conversation partners
   - `declined_user_ids`
3. Query top 20 candidate profiles
4. If no candidates → status = `no_candidates`, exit
5. Call Gemini with conversation history + candidates
6. Parse AI response: `{matchId, matchReason, introMessage}`
7. Validate `matchId` exists in candidate list
8. If invalid → status = `no_candidates`, exit
9. Update match_request:
   - status = `pending_approval`
   - matched_user_id = matchId
   - match_reason = matchReason (3 bullets)

### Error Handling
| Error | Action |
|-------|--------|
| AI fails | Set status = `no_candidates` |
| Invalid matchId | Set status = `no_candidates` |
| No candidates | Set status = `no_candidates` |

### File Location
`app/actions/matchmaker.ts`

---

## respondToMatch

### Purpose
Handle matched user's accept/decline decision.

### Signature
```typescript
async function respondToMatch(
  requestId: string,
  accepted: boolean
): Promise<{
  success: boolean
  conversationId?: string
  error?: string
}>
```

### Input
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `requestId` | string | Yes | Match request ID in 'pending_approval' state |
| `accepted` | boolean | Yes | true = accept, false = decline |

### Output (Accepted)
```typescript
{
  success: true,
  conversationId: string  // Created conversation ID
}
```

### Output (Declined)
```typescript
{
  success: true
}
```

### Output (Error)
```typescript
{
  success: false,
  error: string
}
```

### Business Rules (Accepted)
1. Verify user is `matched_user_id` and status = `pending_approval`
2. Create conversation with 24h timer
3. Add both users as participants
4. Generate intro message (AI, optional)
5. Post intro message as Trio
6. Update match_request:
   - status = `accepted`
   - conversation_id = created conversation
7. Return `conversationId` for redirect

### Business Rules (Declined)
1. Verify user is `matched_user_id` and status = `pending_approval`
2. Add `matched_user_id` to `declined_user_ids`
3. Clear `matched_user_id` and `match_reason`
4. Update status = `searching`
5. Call `findMatch(requestId)` in background (retry)

### Error Responses
- Unauthorized: `{ success: false, error: 'Unauthorized' }`
- Not found: `{ success: false, error: 'Match request not found' }`
- Conversation creation failed: `{ success: false, error: 'Failed to create conversation' }`

### File Location
`app/actions/matchmaker.ts`

---

## getActiveMatchRequest

### Purpose
Get user's current active match request (if any).

### Signature
```typescript
async function getActiveMatchRequest(): Promise<MatchRequest | null>
```

### Input
None (uses authenticated user from session)

### Output
```typescript
MatchRequest | null
```

### Business Rules
1. Get authenticated user ID
2. Auto-expire stale requests:
   - status IN (`chatting`, `searching`, `pending_approval`)
   - expires_at < now()
   - Set status = `expired`
3. Query match_requests:
   - requester_id = user.id
   - status IN (`chatting`, `searching`, `pending_approval`)
   - Order by created_at DESC
   - Limit 1
4. Return most recent active request or null

### File Location
`app/actions/matchmaker.ts`

---

## getPendingMatchForUser

### Purpose
Get match requests where current user is the proposed match.

### Signature
```typescript
async function getPendingMatchForUser(): Promise<(MatchRequest & {
  requester_profile: Profile
}) | null>
```

### Input
None (uses authenticated user from session)

### Output
```typescript
(MatchRequest & { requester_profile: Profile }) | null
```

### Business Rules
1. Get authenticated user ID
2. Auto-expire stale pending requests
3. Query match_requests:
   - matched_user_id = user.id
   - status = `pending_approval`
   - Order by created_at DESC
   - Limit 1
4. Fetch requester's profile (for match card display)
5. Return request + profile or null

### File Location
`app/actions/matchmaker.ts`

---

## Acceptance Criteria

- [ ] chatWithMatchmaker creates match_request if not provided
- [ ] chatWithMatchmaker forces readyToSearch after 3 AI replies
- [ ] findMatch excludes self, existing partners, declined users
- [ ] findMatch validates matchId against candidate list
- [ ] respondToMatch creates conversation with 24h timer on accept
- [ ] respondToMatch retries with new candidate on decline
- [ ] getActiveMatchRequest auto-expires stale requests
- [ ] getPendingMatchForUser includes requester profile
- [ ] All functions handle authentication errors gracefully
