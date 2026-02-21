# Kintsu: The AI-Mediated Social Connection App

Welcome to **Kintsu**! This document serves as an onboarding guide to help you get up to speed with the project's architecture, codebase, and core algorithms. 

Kintsu is a platform designed to foster authentic connections. Unlike traditional matching apps, Kintsu is powered by a central AI agent via the Google Gemini API. This single AI operates under two distinct roles:
1. **The Matchmaker**: Interviews users to understand their vibe and intelligently matches them with compatible candidates based on rich profile data.
2. **The Social Catalyst**: A "mutual friend" presence that quietly observes active chat rooms and interjects seamlessly when it detects a "Spark Point" or a lull in the conversation.

> **Note on Naming (Trio vs. Kintsu)**
> The application was originally named **Trio** and was later rebranded to **Kintsu**. Because of this, you will still see the name "Trio" used extensively throughout the active codebase—specifically in environment variables, file names (like `trio-config.ts`), and function names (like `generateTrioResponse`). For all engineering purposes, "Trio" and "Kintsu" refer to the exact same AI system.

---

## 🛠️ The Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Actions)
- **Frontend library**: React, [TailwindCSS](https://tailwindcss.com/) (Styling), Framer Motion (Animations), Lucide React (Icons)
- **Backend/Database**: [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, Real-Time Subscriptions)
- **AI Integration**: [Google Gemini API](https://ai.google.dev/) (via `@google/generative-ai` SDK)
- **Testing**: [Vitest](https://vitest.dev/) and React Testing Library

---

## 🚀 Getting Started Locally

### 1. Prerequisites
- **Node.js**: (Ensure you have a recent LTS version)
- **Package Manager**: Make sure you have `npm` installed.

### 2. Installation
Clone the repository, then install dependencies:
```bash
npm install
```

### 3. Environment Variables
To run the app locally, you need a `.env.local` file in the root directory. This project includes a `.env.example` file you can copy.
```bash
cp .env.example .env.local
```

You will need to fill in these values:
1. **Supabase Keys**: Since you have been invited to the team's Supabase project, you can pull the `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the `NEXT_PUBLIC_TRIO_USER_ID` straight from the Supabase dashboard. 
2. **Gemini API Key**: For AI generation, please go to [Google AI Studio](https://aistudio.google.com/) and generate your own free Gemini API Key to use locally. 

Your `.env.local` should look like this:
```env
NEXT_PUBLIC_SUPABASE_URL=<from-supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from-supabase>
SUPABASE_SERVICE_ROLE_KEY=<from-supabase> # Required for background server actions bypassing RLS
GOOGLE_API_KEY=<your-personal-gemini-key>
NEXT_PUBLIC_TRIO_USER_ID=<uuid-of-the-ai-user-in-db>
```
*Note: The `trio_user_id` represents the system AI user that posts messages into conversations.*

### 4. Running the Dev Server
```bash
npm run dev
```
The app should now be running at `http://localhost:3000`.

---

## 🏗️ Architecture & Core Flows

The codebase uses Next.js **Server Actions** (`/app/actions/...`) to handle business logic securely on the server. The Supabase database holds the core state, while Real-time subscriptions update the UI instantly.

### The Matchmaking Algorithm (Kintsu)

File: `app/actions/matchmaker.ts`

The matchmaking system is designed as an interactive, multi-step flow:
1. **Chatting Phase**: When a user requests a match, an entry is created in the `match_requests` table. The Gemini AI (prompted as **Kintsu**) strikes up a 3-turn conversation to understand the user's specific vibe and desires.
2. **Searching Phase**: Upon concluding the interview, the request status is flipped to `searching`. The app queries the `profiles` table (respecting exclusions and existing partners).
3. **AI Matching Decision**: Gemini receives the user's interview history alongside a list of candidates' `profiles` (which contain `identity_chips`, `sliders`, and `ai_summary`). The AI selects the most compatible UUID and provides a concise 3-bullet `matchReason`.
4. **Approval & Introduction**: Once the user approves the match, a new record in `conversations` is spawned. Kintsu drops into the chat to introduce both parameters based on their shared context.

### The Social Catalyst Flow

Files: `app/actions/ai.ts`, `lib/trio-config.ts`

*(Note: Due to the legacy naming, this domain of the code still uses the "Trio" identifier).*

In this role, the AI acts as a proactive mutual friend rather than a reactive chatbot.
- **Continuous Evaluation**: Every time a user sends a message, the `evaluateConversationState()` function triggers. It pulls the last 3 messages and asks a lightweight Gemini model to "Judge" the state of the conversation.
- **The Scoring Rubric**: This is centrally controlled in `lib/trio-config.ts`. The AI outputs a score (0-10) determining the opportunity for an interjection. 
  - *8-10 (Must Speak):* High shared interest, users explicitly needing a nudge, or explicitly mentioning the AI.
  - *0-3 (Silence):* Short replies, emotional topics, or logistics.
- **Interjection Threshold**: If the returned score exceeds `INTERJECTION_THRESHOLD` (currently set to 7), the `generateTrioResponse()` is invoked, and the AI generates a witty reply and inserts it directly into the `messages` table via the `adminClient`.

### Real-Time Synchronization

The platform utilizes **Supabase Realtime**. Tables like `match_requests` and `messages` have publications enabled in Postgres. Client-side components (like the `ChatWindow` and `ConservationList`) use `@supabase/supabase-js`'s `.channel().on('postgres_changes', ...)` listeners to auto-update state without polling.

---

## 🗄️ Database Schema Highlights

The Supabase project heavily relies on **Row Level Security (RLS)** to protect user data. 

*   `profiles`: Contains user psychographics. Notable columns:
    *   `sliders` (JSONB): Scales like social_battery, risk, planning.
    *   `identity_chips` (TEXT[]): Short, tagged interests.
    *   `ai_summary` (TEXT): An AI profile summary editable by the user.
*   `match_requests`: Tracks the lifecycle of a match (`requester_id`, `status`, `matched_user_id`, `conversation_history`).
*   `conversations` & `participants`: Defines N:N chat groupings.
*   `messages`: Where the chat history lives. Distinguishes bot messages via the `is_ai_generated` boolean.

---

## 🧪 Testing

We use **Vitest** given its seamless compatibility with Vite/Next.js and ES modules.
Configuration is stored in `vitest.config.ts`.
Tests reside in the `__tests__` dir (e.g., `__tests__/components/` and `__tests__/actions/`).

### How to Run Tests
- **Single run:** `npm run test:run`
- **Watch mode:** `npm run test` or `npm t`

### Mocking Patterns
Server Actions and external databases are frequently mocked. We use `vi.hoisted()` in tandem with `vi.mock()` to ensure environment variables and Supabase DB clients are isolated before they are imported by the actual tested modules. 

---

Welcome aboard! If you have any questions, explore the `/actions` logic first, as that forms the nucleus of Kintsu's intelligence!
