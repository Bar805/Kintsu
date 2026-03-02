# Glossary

## Purpose
Shared domain terminology for the Kintsu application. All specs reference these definitions.

## Core Personas

| Term | Definition |
|------|------------|
| **Trio** | AI persona that interjects in conversations. A system user (UUID stored in `NEXT_PUBLIC_TRIO_USER_ID`), not a conversation participant. Posts messages via admin client. |
| **Kintsu** | AI matchmaker persona used during matchmaking discovery phase. Asks 2 follow-up questions to understand user preferences. |

## Matchmaking Terms

| Term | Definition |
|------|------------|
| **Match Request** | State machine representing a user's search for a match. States: `chatting`, `searching`, `pending_approval`, `accepted`, `declined`, `expired`, `no_candidates`. |
| **Requester** | User who initiates a match request (the one looking for a match). |
| **Matched User** | User selected as a potential match, shown a profile card for approval. |
| **Match Reason** | 3 bullet points (max 8 words each) explaining why two users are matched. Shown on the match approval card. |
| **Declined User** | User who was proposed as a match but declined. Stored in `declined_user_ids` array to prevent re-matching. |
| **Candidate Pool** | Set of profiles eligible for matching (excludes self, existing partners, declined users). Limited to 20 profiles. |

## Chat Terms

| Term | Definition |
|------|------------|
| **Conversation** | 1:1 chat session between two matched users. Has a 24-hour timer, active/archived state, and metadata. |
| **Participant** | User who is a member of a conversation. Junction table for many-to-many relationship. |
| **Timer** | 24-hour countdown starting when conversation is created. Clears (becomes `null`) when both users send at least one message. |
| **Archived Conversation** | Conversation where `is_active = false`. Cannot receive new messages. Occurs when timer expires before both users message. |
| **Optimistic Update** | Client-side UI pattern where message appears immediately before server confirmation. Real message ID replaces optimistic ID on confirmation. |

## AI Terms

| Term | Definition |
|------|------------|
| **Interjection** | AI-generated message from Trio that appears in a conversation. Triggered when evaluation score >= 7. |
| **Evaluation Phase** | First phase of interjection: score conversation (0-10) based on last 3 messages. Uses Gemini Flash. |
| **Generation Phase** | Second phase of interjection: generate Trio's response based on last 10 messages + profiles. Uses Gemini Flash. |
| **Scoring Rubric** | AI prompt defining when Trio should speak (score 0-10). Stored in `TRIO_CONFIG.SCORING_RUBRIC`. |
| **System Prompt** | AI prompt defining Trio's persona and behavior. Stored in `TRIO_CONFIG.SYSTEM_PROMPT`. |
| **Interjection Threshold** | Minimum score (7/10) required for Trio to speak. Stored in `TRIO_CONFIG.INTERJECTION_THRESHOLD`. |

## Meetup Terms

| Term | Definition |
|------|------------|
| **Interested** | User state indicating desire to meet offline. Represented by ☕ button. Double-blind: neither user sees other's status until both mark interested. |
| **Meetup Suggestion** | AI-generated message with 2 verified venue recommendations + Google Maps links. Triggered when both users mark interested. |
| **RAG Pipeline** | 3-stage process: (1) Extract search queries, (2) Resolve venues via Google Places API, (3) Synthesize message with verified venues. |
| **Verified Venue** | Real place confirmed via Google Places API. Includes: name, address, Google Maps URI, category. Never invented by AI. |
| **Location Context** | City/area mentioned in conversation, used to suffix search queries (e.g., "bouldering gym in New Haven"). |

## Database Terms

| Term | Definition |
|------|------------|
| **RLS** | Row Level Security. Postgres feature enforcing data access rules at database level. All tables have RLS enabled. |
| **Admin Client** | Supabase client using service role key. Bypasses RLS. Used ONLY for system operations (Trio messages, bulk updates). |
| **Regular Client** | Supabase client using anon key. Enforces RLS. Used for all user-facing operations. |
| **Real-time Channel** | Supabase WebSocket subscription for live updates (messages, conversations, match requests). |

## UI Terms

| Term | Definition |
|------|------------|
| **Match Card** | Profile card shown to matched user during `pending_approval` state. Displays: avatar, bio, interests, match reason, accept/decline buttons. |
| **Chat Window** | Real-time messaging interface. Shows messages, timer countdown, interested button, meetup place cards. |
| **Place Card** | UI component showing verified venue (name, category, address, Google Maps link). Appears in meetup suggestion messages. |
| **Toast** | Temporary notification (Sonner library). Used for success/error feedback. |

## State Machine Terms

| Term | Definition |
|------|------------|
| **chatting** | Match request state: Kintsu is asking discovery questions (max 3 AI replies). |
| **searching** | Match request state: AI is evaluating candidate profiles (~5-10 seconds). |
| **pending_approval** | Match request state: Matched user is reviewing profile card. 24h timeout. |
| **accepted** | Terminal match request state: Match approved, conversation created. |
| **declined** | Match request state: Match rejected, system retries with next candidate. |
| **expired** | Terminal match request state: 24h timeout passed without response. |
| **no_candidates** | Terminal match request state: No suitable matches available. |

## Technical Terms

| Term | Definition |
|------|------------|
| **Server Action** | Next.js function with `'use server'` directive. Runs on server, can access secrets. All mutations use server actions. |
| **Structured Output** | Gemini API feature enforcing JSON response format via `responseMimeType: 'application/json'` + `responseSchema`. |
| **Exponential Backoff** | Retry pattern for rate limits: wait 2s, 4s, 8s between attempts. Used for all Gemini API calls. |
| **Optimistic UI** | Pattern where UI updates immediately, then reconciles with server response. Used for message sending. |
