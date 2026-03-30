# Message Interpretation: Semantic Analysis

Analyze this message and provide a semantic interpretation extracting deeper meaning beyond the literal text.

## Message to Interpret

**Sender:** {{SENDER_NAME}}
**Content:** "{{MESSAGE_CONTENT}}"

## Recent Context (last 3 messages)

{{RECENT_MESSAGES}}

## Your Task

Extract the deeper meaning and social dynamics:

### 1. Emotional Tone
- Enthusiastic, hesitant, awkward, confident, uncertain, excited, reserved, etc.

### 2. Connection Signals
- Showing interest in the other person?
- Asking questions to learn more?
- Building on previous topics?
- Opening up or holding back?

### 3. Friction Points
- Confusion or misunderstanding?
- Disagreement or topic mismatch?
- Awkward silence or dead-end response?
- Energy shift (positive or negative)?

### 4. Interest Mentions
- Explicit references to hobbies/activities?
- Implicit interests (e.g., "I went to a concert" implies music interest)?
- Shared or divergent interests with the other user?

## Examples

**Example 1:**
```
Message: "I've been to East Rock a few times, it's pretty nice"
Interpretation: "User expressing positive familiarity with outdoor activity; casual tone; indirect agreement with previous hiking mention; potential connection opportunity; slightly reserved response suggests testing interest"
```

**Example 2:**
```
Message: "Yeah same"
Interpretation: "Minimal engagement; low-effort agreement; conversation losing momentum; no new information shared; friction risk - needs new topic or question"
```

**Example 3:**
```
Message: "OMG yes! I go there every weekend! Have you tried the blue trail?"
Interpretation: "High enthusiasm; strong connection signal; building on shared interest; asking follow-up question; positive energy; actively driving conversation forward"
```

## Output Format

Provide a **1-2 sentence interpretation** that captures:
- Emotional tone
- Connection signals or friction points
- Interest mentions (if any)
- Social dynamics

## Guidelines

- **Go beyond literal meaning** - what's the subtext?
- **Be concise** - 1-2 sentences maximum
- **Focus on connection dynamics** - this helps Trio facilitate
- **Note energy shifts** - is momentum building or fading?
- **Identify opportunities** - where could Trio help?
