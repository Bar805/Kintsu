# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint
```

No test framework is configured.

## Architecture

**Kintsu** is a social matchmaking app where an AI persona ("Trio") facilitates 1:1 conversations between matched users. Built with Next.js App Router, Supabase, and Google Gemini.

### Stack
- **Next.js 14+** with App Router, TypeScript (strict), Tailwind CSS v4
- **Supabase** for auth, PostgreSQL database, real-time subscriptions
- **Google Gemini API** (`@google/generative-ai`) for all AI features
- **Framer Motion** for animations, **Sonner** for toasts

### Key Directories
- `app/actions/` — Server actions (`'use server'`) for all mutations and AI calls
- `app/api/suggestions/` — GET endpoint for chat icebreaker/reply suggestions
- `app/dashboard/` — Main pages (conversation list, profile)
- `components/` — Client components (`'use client'`) with real-time Supabase subscriptions
- `lib/trio-config.ts` — Trio AI system prompt and scoring rubric
- `types/database.ts` — TypeScript interfaces for all DB models
- `utils/supabase/` — Server (`server.ts`), browser (`client.ts`), and middleware clients

### Core Flows

**Matchmaking** (`matchmaker.ts`, `MatchmakerModal.tsx`): State machine — chatting → searching → pending_approval → accepted/declined/expired. Kintsu asks follow-up questions, then scores candidate profiles via Gemini to find the best match.

**Chat** (`chat.ts`, `ChatWindow.tsx`): Real-time 1:1 messaging with a 24-hour expiry timer (resets on alternating messages). Trio auto-interjects when a scoring rubric (0-10) triggers ≥7. Double-blind "interested" button (☕) — neither user sees the other's interest until both opt in.

**Meetup Suggestions** (`chat-suggestions.ts`): Triggered when both users mark interested AND a random message threshold is hit. Generates 2 real venue suggestions with Google Maps links.

### Supabase Patterns
- **Admin client** (service role key) is used only for Trio system messages — bypasses RLS
- **Regular client** (anon key) for all user-facing operations with RLS enforced
- `NEXT_PUBLIC_TRIO_USER_ID` is a special system user ID for Trio's messages
- Real-time channels subscribe to `messages`, `match_requests`, `conversations` table changes

### AI Integration
- All Gemini calls use retry logic with exponential backoff (2s, 4s, 8s) for 429 rate limits
- Models: `gemini-2.5-flash` (chat, suggestions) and `gemini-2.5-pro` (evaluation)
- JSON response format enforced via `responseMimeType: "application/json"`
- Console logging prefixed with `[ai]`, `[suggestions]`, `[matchmaker]`

### Environment Variables (.env.local)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `GOOGLE_API_KEY` (Gemini)
- `NEXT_PUBLIC_TRIO_USER_ID` (Trio system user)

### Theme Colors
cream (#F9F8F4), sand (#E8E6DF), rust (#D95D39), teal (#2B6B6E), mustard (#F0C419), charcoal (#2D2D2D)
