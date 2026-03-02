# Review Notes

**Date:** 2026-03-02
**Reviewer:** Spec Refactoring Agent

## Purpose
Document ambiguities, contradictions, and gaps discovered during spec refactoring.

---

## Ambiguities Found

### 1. meetup_trigger_after Field (Conversation Model)

**Location:** `data-models/conversation.md`, `features/meetup-suggestions.md`

**Issue:** The `meetup_trigger_after` field in conversations table is marked as "Legacy" and unused, but still exists in schema.

**Details:**
- Original design: Trigger meetup after both interested + N messages
- Current design: Trigger immediately when both interested
- Field kept for backwards compatibility but never read/written

**Recommendation:**
- Option A: Remove field in next migration (breaking change)
- Option B: Document clearly as deprecated in schema comments
- Option C: Use field for future "delayed trigger" feature

**Status:** 🟡 Low priority - Not blocking, just technical debt

---

### 2. AI Model Selection (Current vs Future)

**Location:** `infrastructure/ai-integration.md`

**Issue:** All AI features currently use `gemini-2.5-flash`, but spec mentions `gemini-2.5-pro` for evaluation.

**Details:**
- Current: Everything uses Flash (speed + cost optimization)
- Original spec mentioned: Pro for evaluation/scoring
- No clear decision documented on why Flash chosen for all

**Recommendation:**
- Document decision: "Flash chosen for all to optimize cost/latency"
- Add acceptance criteria: "Monitor evaluation accuracy, upgrade to Pro if needed"
- Consider A/B testing Pro vs Flash for interjection scoring

**Status:** 🟢 Resolved - Clarified in ai-integration.md

---

### 3. Profile Candidate Pool Size

**Location:** `features/matchmaking-flow.md`

**Issue:** Hard-coded limit of 20 candidates not explained.

**Details:**
- Query limits to 20 profiles
- No pagination or ranking before AI selection
- Unclear why 20 (performance? AI context limit? arbitrary?)

**Recommendation:**
- Document rationale: "20 chosen to balance AI context window vs candidate diversity"
- Add TODO: "Future: pre-rank candidates before sending to AI (reduce to top 10)"

**Status:** 🟡 Low priority - Works but could be optimized

---

### 4. Timer Clearing Logic

**Location:** `features/timer-system.md`, `api/chat-actions.md`

**Issue:** Timer clears when BOTH users message (not alternating), but original intent unclear.

**Details:**
- Current: User A sends 5 messages, User B sends 1 → timer clears
- Alternative design: Require alternating messages (A → B → timer clears)
- Spec doesn't explain why "both messaged" vs "alternating" chosen

**Recommendation:**
- Add business rule explanation: "Timer clears when both message (not alternating) to reduce friction"
- Document edge case: "If User A spams messages before User B replies, timer still clears after B's first message"

**Status:** 🟢 Resolved - Clarified in timer-system.md

---

### 5. Real-time Subscription Cleanup

**Location:** `infrastructure/supabase-patterns.md`

**Issue:** No documented handling of subscription errors or reconnection edge cases.

**Details:**
- Spec shows basic cleanup pattern (removeChannel in useEffect)
- Doesn't address: What if reconnection fails? What if channel errors?
- Supabase auto-reconnects, but no spec on how to handle reconnection state

**Recommendation:**
- Add acceptance criteria: "On reconnect, refetch last N messages to ensure no gaps"
- Document error handling: "If channel errors, show 'Connection lost' banner, refetch on recovery"

**Status:** 🟡 Medium priority - Should document edge cases

---

## Contradictions Found

### None

No contradictions found between specs. All data models, features, and APIs align consistently.

---

## Gaps Identified

### 1. Profile CRUD Actions

**Location:** `api/` directory

**Gap:** Profile actions (create, update, delete) not documented in api/ specs.

**Impact:** Medium - Profile management is a core feature but API contract not specified

**Recommendation:**
- Create `api/profile-actions.md` with contracts for:
  - `createProfile()`
  - `updateProfile()`
  - `deleteProfile()`
  - `generateAISummary()`

**Status:** 🟠 Should be added for completeness

---

### 2. Suggestion Actions

**Location:** `api/` directory

**Gap:** `markInterested()` and `generateMeetupSuggestion()` mentioned in features but no API spec.

**Impact:** Low - Covered in feature specs, but missing from API directory

**Recommendation:**
- Create `api/suggestion-actions.md` with:
  - `markInterested(conversationId)`
  - `generateMeetupSuggestion(conversationId)`
  - `getConversationMeta(conversationId)`

**Status:** 🟠 Should be added for API completeness

---

### 3. Background Job Specification

**Location:** Missing

**Gap:** `archiveExpiredConversations()` mentioned as cron job, but no spec for job scheduling.

**Impact:** Low - Implementation detail, but useful for deployment

**Recommendation:**
- Create `infrastructure/background-jobs.md` with:
  - Cron job specifications
  - Frequency (every 5 minutes)
  - Error handling for batch operations
  - Monitoring/alerting

**Status:** 🟡 Nice to have

---

### 4. UI Component Specifications

**Location:** Missing

**Gap:** Component contracts not specified (only mentioned in feature specs).

**Impact:** Low - UI implementation detail, but useful for frontend devs

**Recommendation:**
- Consider adding `ui/` directory with component contracts:
  - Props interfaces
  - State management patterns
  - Real-time subscription setup

**Status:** 🟢 Optional - Outside scope of backend specs

---

## Clarifications Made During Refactoring

### 1. Admin Client vs Regular Client

**Clarified:** When to use each client type, with specific examples.

**Location:** `infrastructure/supabase-patterns.md`

**Benefit:** Prevents accidental RLS bypass or insufficient privileges.

---

### 2. Double-Blind Interest Mechanism

**Clarified:** Exact UI behavior when one vs both users mark interested.

**Location:** `features/interest-tracking.md`

**Benefit:** Eliminates ambiguity about what each user sees.

---

### 3. Meetup Suggestion Trigger Timing

**Clarified:** Immediate trigger when both interested (no message threshold in current design).

**Location:** `features/meetup-suggestions.md`, `features/interest-tracking.md`

**Benefit:** Clears up confusion about `meetup_trigger_after` field.

---

## Recommendations for Next Steps

### High Priority
1. ✅ Create `api/profile-actions.md` (gap #1)
2. ✅ Create `api/suggestion-actions.md` (gap #2)

### Medium Priority
3. 🟡 Document real-time edge cases (ambiguity #5)
4. 🟡 Decide on `meetup_trigger_after` field fate (ambiguity #1)

### Low Priority
5. 🟢 Add background jobs spec (gap #3)
6. 🟢 Consider A/B test for Gemini Pro vs Flash (ambiguity #2)
7. 🟢 Document candidate pool size rationale (ambiguity #3)

---

## Overall Assessment

**Spec Quality:** ✅ High

The original specs were comprehensive and well-structured. Refactoring successfully decomposed them into focused, actionable documents. No major contradictions or blocking ambiguities found.

**Coverage:** ✅ Complete (with minor gaps)

All core features, data models, and business logic fully documented. Minor gaps in API contracts and infrastructure specs.

**Actionability:** ✅ Excellent

Each spec can now be handed to an agent for standalone implementation. Cross-references keep context when needed.

---

**End of Review Notes**
