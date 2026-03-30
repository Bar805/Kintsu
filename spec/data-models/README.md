# Data Models Overview

Complete reference for all database tables, relationships, and cognitive AI system architecture.

---

## Table of Contents

1. [Core Tables](#core-tables)
2. [Cognitive AI Tables](#cognitive-ai-tables)
3. [Table Relationships](#table-relationships)
4. [Entity-Relationship Diagram](#entity-relationship-diagram)
5. [Cognitive System Architecture](#cognitive-system-architecture)
6. [Generating Database Diagrams](#generating-database-diagrams)

---

## Core Tables

| Table            | Purpose                                   | Documentation                          |
| ---------------- | ----------------------------------------- | -------------------------------------- |
| `profiles`       | User identity, interests, bio, embeddings | [profile.md](./profile.md)             |
| `match_requests` | Matchmaking state machine                 | [match-request.md](./match-request.md) |
| `conversations`  | 1:1 chat sessions with timer              | [conversation.md](./conversation.md)   |
| `participants`   | Links users to conversations              | [participant.md](./participant.md)     |
| `messages`       | Chat messages (user + AI)                 | [message.md](./message.md)             |

---

## Cognitive AI Tables

| Table               | Purpose                                           | Documentation                                  |
| ------------------- | ------------------------------------------------- | ---------------------------------------------- |
| `trio_thoughts`     | All thoughts Trio generates (System 1 + System 2) | [trio-thought.md](./trio-thought.md)           |
| `thought_stimuli`   | Tracks inputs that inspired each thought          | [thought-stimulus.md](./thought-stimulus.md)   |
| `interest_saliency` | Dynamic relevance scores for interests            | [interest-saliency.md](./interest-saliency.md) |
| `message_memory`    | Short-term memory with interpretations            | [message-memory.md](./message-memory.md)       |

---

## Table Relationships

### Core System

```
profiles (users)
    ├─→ match_requests (requester_id, candidate_id)
    ├─→ participants (user_id)
    ├─→ messages (sender_id)
    └─→ interest_saliency (user_id)

conversations
    ├─→ participants (conversation_id) [exactly 2]
    ├─→ messages (conversation_id)
    ├─→ trio_thoughts (conversation_id)
    ├─→ interest_saliency (conversation_id)
    └─→ message_memory (conversation_id)

messages
    ├─→ trio_thoughts (trigger_message_id) [if message triggered thoughts]
    ├─→ message_memory (message_id) [1:1]
    └─→ trio_thoughts (articulated_message_id) [if Trio message]
```

### Cognitive System

```
trio_thoughts
    ├─→ thought_stimuli (thought_id) [2-5 stimuli for System 2]
    └─→ messages (articulated_message_id) [if selected]

thought_stimuli
    ├─→ interest_saliency (stimulus_ref_id) [if type = 'interest']
    ├─→ message_memory (stimulus_ref_id) [if type = 'message']
    ├─→ trio_thoughts (stimulus_ref_id) [if type = 'previous_thought']
    └─→ profiles (stimulus_ref_id) [if type = 'profile_bio']

message_memory
    └─→ messages (message_id) [1:1]

interest_saliency
    ├─→ conversations (conversation_id)
    └─→ profiles (user_id)
```

---

## Entity-Relationship Diagram

### Core Tables

```mermaid
erDiagram
    profiles ||--o{ match_requests : "creates/receives"
    profiles ||--o{ participants : "joins"
    profiles ||--o{ messages : "sends"

    conversations ||--o{ participants : "has"
    conversations ||--o{ messages : "contains"
    conversations ||--o{ trio_thoughts : "triggers"
    conversations ||--o{ interest_saliency : "tracks"
    conversations ||--o{ message_memory : "remembers"

    messages ||--o| message_memory : "interpreted as"
    messages ||--o{ trio_thoughts : "triggers"
    messages ||--o| trio_thoughts : "articulated from"

    profiles {
        uuid id PK
        string email UK
        string first_name
        string last_name
        string avatar_url
        string bio
        string[] interests
        vector_768[] interests_embeddings
        vector_768 bio_embedding
    }

    conversations {
        uuid id PK
        timestamptz timer_expires_at
        boolean is_active
        uuid[] interested_user_ids
        boolean meetup_suggested
    }

    participants {
        uuid id PK
        uuid conversation_id FK
        uuid user_id FK
    }

    messages {
        uuid id PK
        uuid conversation_id FK
        uuid sender_id FK
        text content
        boolean is_ai_generated
        uuid thought_id FK
    }

    match_requests {
        uuid id PK
        uuid requester_id FK
        uuid candidate_id FK
        string status
        timestamptz expires_at
    }
```

### Cognitive AI Tables

```mermaid
erDiagram
    trio_thoughts ||--o{ thought_stimuli : "inspired by"
    trio_thoughts ||--o| messages : "becomes"

    thought_stimuli }o--|| interest_saliency : "references"
    thought_stimuli }o--|| message_memory : "references"
    thought_stimuli }o--|| trio_thoughts : "references"
    thought_stimuli }o--|| profiles : "references"

    message_memory ||--|| messages : "interprets"

    interest_saliency }o--|| conversations : "scoped to"
    interest_saliency }o--|| profiles : "belongs to"

    trio_thoughts {
        uuid id PK
        uuid conversation_id FK
        uuid trigger_message_id FK
        system_type system_type
        string category
        text content
        decimal motivation_score
        boolean was_selected
        uuid articulated_message_id FK
    }

    thought_stimuli {
        uuid id PK
        uuid thought_id FK
        stimulus_type stimulus_type
        uuid stimulus_ref_id
        text stimulus_text
        decimal saliency_score
    }

    interest_saliency {
        uuid id PK
        uuid conversation_id FK
        uuid user_id FK
        text interest_text UK
        decimal saliency_score
        vector_768 embedding
    }

    message_memory {
        uuid id PK
        uuid conversation_id FK
        uuid message_id FK_UK
        text interpretation
        decimal saliency_score
        vector_768 embedding
    }
```

---

## Cognitive System Architecture

### Thought Generation Flow

```mermaid
flowchart TD
    Msg[New Message] --> Phase2[Phase 2: Update Saliency]
    Phase2 --> UpdateInt[Update interest_saliency scores]
    Phase2 --> UpdateMem[Update message_memory scores]

    UpdateInt --> Phase3[Phase 3: Add to Memory]
    UpdateMem --> Phase3
    Phase3 --> CreateMem[Create message_memory record]

    CreateMem --> Phase4[Phase 4: Generate Thoughts]
    Phase4 --> Sys1[System 1: Quick reaction]
    Phase4 --> Sys2[System 2: Deliberate]

    Sys1 --> CreateT1[Create 1 trio_thought]
    Sys2 --> CreateT2[Create 2 trio_thoughts]
    Sys2 --> CreateStim[Create thought_stimuli<br/>citing interests/messages]

    CreateT1 --> Phase5[Phase 5: Evaluate]
    CreateT2 --> Phase5
    CreateStim --> Phase5

    Phase5 --> Score[Score all 3 thoughts]
    Score --> Phase6{Phase 6: Select<br/>top >= 3.5?}

    Phase6 -->|No| Silent[Stay silent]
    Phase6 -->|Yes| Phase7[Phase 7: Articulate]
    Phase7 --> Phase8[Phase 8: Post message]
    Phase8 --> LinkMsg[Link thought ↔ message]
```

### Saliency System

```mermaid
flowchart LR
    subgraph Bootstrap["On First Message"]
        Prof[profiles.interests] --> Copy[Copy embeddings]
        Copy --> IntSal[interest_saliency<br/>saliency = 0.5]
    end

    subgraph Update["On Every Message"]
        NewMsg[New message embedding] --> Sim[Compute cosine similarity]
        OldSal[Old saliency score] --> Decay[× 0.99 decay]
        Sim --> Boost[Similarity boost]
        Decay --> Combine[new_score = decay + boost]
        Boost --> Combine
        Combine --> IntSal2[Update interest_saliency]
    end

    subgraph Usage["In System 2"]
        IntSal2 --> Top5[Top 5 salient interests]
        Top5 --> Thought[System 2 thought generation]
    end
```

---

## Generating Database Diagrams

### Option 1: Mermaid (Recommended - Native Rendering)

The diagrams above use [Mermaid](https://mermaid.js.org/), which renders automatically in:

- GitHub
- GitLab
- VS Code (with extension)
- Many documentation tools

**No setup required** - diagrams render directly in markdown viewers.

---

### Option 2: dbdiagram.io (Interactive, Shareable)

**Website:** https://dbdiagram.io/

**Copy this DBML code** to generate an interactive ER diagram:

```dbml
// Core Tables
Table profiles {
  id uuid [pk]
  email text [unique, not null]
  first_name text [not null]
  last_name text [not null]
  avatar_url text [not null]
  bio text
  interests text[]
  interests_embeddings vector_768[]
  bio_embedding vector_768
}

Table conversations {
  id uuid [pk]
  timer_expires_at timestamptz
  is_active boolean [not null, default: true]
  interested_user_ids uuid[]
  meetup_suggested boolean [default: false]
}

Table participants {
  id uuid [pk]
  conversation_id uuid [not null, ref: > conversations.id]
  user_id uuid [not null, ref: > profiles.id]
}

Table messages {
  id uuid [pk]
  conversation_id uuid [not null, ref: > conversations.id]
  sender_id uuid [not null, ref: > profiles.id]
  content text [not null]
  is_ai_generated boolean [default: false]
  thought_id uuid [ref: > trio_thoughts.id]
  thought_category text
  motivation_score decimal
}

Table match_requests {
  id uuid [pk]
  requester_id uuid [not null, ref: > profiles.id]
  candidate_id uuid [not null, ref: > profiles.id]
  status text [not null]
  expires_at timestamptz
}

// Cognitive AI Tables
Table trio_thoughts {
  id uuid [pk]
  conversation_id uuid [not null, ref: > conversations.id]
  trigger_message_id uuid [not null, ref: > messages.id]
  system_type system_type [not null]
  category text [not null]
  content text [not null]
  motivation_score decimal [not null]
  was_selected boolean [default: false]
  articulated_message_id uuid [ref: > messages.id]
}

Table thought_stimuli {
  id uuid [pk]
  thought_id uuid [not null, ref: > trio_thoughts.id]
  stimulus_type stimulus_type [not null]
  stimulus_ref_id uuid
  stimulus_text text
  saliency_score decimal [not null]
}

Table interest_saliency {
  id uuid [pk]
  conversation_id uuid [not null, ref: > conversations.id]
  user_id uuid [not null, ref: > profiles.id]
  interest_text text [not null]
  saliency_score decimal [default: 0.5]
  embedding vector_768 [not null]
}

Table message_memory {
  id uuid [pk]
  conversation_id uuid [not null, ref: > conversations.id]
  message_id uuid [unique, not null, ref: > messages.id]
  interpretation text [not null]
  saliency_score decimal [default: 1.0]
  embedding vector_768 [not null]
}
```

**Steps:**

1. Go to https://dbdiagram.io/
2. Click "New Diagram"
3. Paste the DBML code above
4. Click "Auto Arrange" for clean layout
5. Export as PNG/SVG/PDF

---

## Key Concepts

### Embedding Vectors

- **Dimension:** 768 (Gemini embedding model output)
- **Purpose:** Semantic similarity search via cosine distance
- **Index:** IVFFlat (approximate nearest neighbor)
- **Tables:** `profiles`, `interest_saliency`, `message_memory`

### Saliency Scores

- **Range:** 0.0 to 2.0+ (typically 0.0-1.5)
- **Decay Factors:**
  - Interests: 0.99 (slow - stable traits)
  - Messages: 0.95 (fast - ephemeral context)
- **Update:** Every new message in conversation

### Thought System Types

- **System 1:** Fast, intuitive (1 thought per trigger, no stimuli)
- **System 2:** Deliberate, memory-based (2 thoughts per trigger, 2-5 stimuli)

### RLS (Row Level Security)

All tables enforce participant-only access via RLS policies. Admin client bypasses RLS for Trio system messages.

---

## See Also

- [ADAPTATION_PLAN.md](../ai_mediator_flow/ADAPTATION_PLAN.md) - Full cognitive workflow specification
- [Supabase Patterns](../infrastructure/supabase-patterns.md) - Database access patterns
- [AI Integration](../infrastructure/ai-integration.md) - Gemini API patterns
