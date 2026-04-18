# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

**Kintsu** is a social matchmaking app where an AI persona ("Trio") facilitates 1:1 conversations between matched users. Built with Next.js App Router, Supabase, and Google Gemini.

### Stack

- **Next.js 14+** with App Router, TypeScript (strict), Tailwind CSS v4
- **Supabase** for auth, PostgreSQL database, real-time subscriptions
- **Google Gemini API** (`@google/generative-ai`) for all AI features
- **Framer Motion** for animations, **Sonner** for toasts

### Supabase Patterns

- **Admin client** (service role key) is used only for Trio system messages — bypasses RLS
- **Regular client** (anon key) for all user-facing operations with RLS enforced
- `NEXT_PUBLIC_TRIO_USER_ID` is a special system user ID for Trio's messages
- Real-time channels subscribe to `messages`, `match_requests`, `conversations` table changes

### AI Integration

- All Gemini calls use retry logic with exponential backoff (2s, 4s, 8s) for 429 rate limits
- Models: `gemini-2.5-flash` (chat, suggestions) and `gemini-2.5-pro` (evaluation)
- JSON response format enforced via `responseMimeType: "application/json"`
- Console logging prefixed with `[ai]`, `[suggestions]`, `[matchmaker]`, `[cognitive]`

### Environment Variables (.env.local)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `GOOGLE_API_KEY` (Gemini)
- `NEXT_PUBLIC_TRIO_USER_ID` (Trio system user)

### Theme Colors

cream (#F9F8F4), sand (#E8E6DF), rust (#D95D39), teal (#2B6B6E), mustard (#F0C419), charcoal (#2D2D2D)

### Spec Programming

The spec directory contains documentation for the project's workflow, data models and other logic description. A human should be able to read this directory to understand the implementation logic without reading code. The documentation files should be as concise as possible (less than 300 lines) and broken down if needed. Every time a new feature is added, th spec documentations should also have corresponding update.
