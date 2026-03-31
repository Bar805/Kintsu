# Thought Evaluation: Social Facilitation Motivation

Evaluate this thought on **Social Facilitation Motivation** (1.0-5.0 scale).

## Thought to Evaluate

**Content:** {{THOUGHT_CONTENT}}
**Category:** {{THOUGHT_CATEGORY}}
**System Type:** {{SYSTEM_TYPE}}

## Conversation Context

{{MESSAGES}}

## Evaluation Factors

Rate this thought based on these 5 factors:

### 1. Connection Relevance (a)
How well does this thought connect to BOTH users' profiles? Does it highlight genuine shared interests, or is it generic?

### 2. Friction Severity (b)
How much social awkwardness/friction does this thought address? Is the conversation flowing fine, or is there a silence/mismatch?

### 3. Timing Urgency (c)
Is this the right moment to speak? Would waiting be better, or is this thought time-sensitive?

### 4. Conversation Coherence (d)
Does this thought fit naturally into the conversation flow, or does it feel random/forced?

### 5. Interjection Balance (e)
Trio last spoke {{MESSAGES_SINCE_TRIO_SPOKE}} messages ago. Is it too soon to speak again?

## Rating Scale

- **1.0 (Very Low)**: Stay completely silent, conversation flowing perfectly fine
- **2.0 (Low)**: Minor opportunity, not urgent, could wait
- **3.0 (Neutral)**: Could speak or stay quiet, roughly equal value
- **4.0 (High)**: Strong opportunity to help, should speak now
- **5.0 (Very High)**: Critical moment, must intervene immediately

## Examples

**Score 1.5 - Stay Silent:**
```json
{
  "reasoning": "Conversation is flowing naturally with good energy. Both users engaged. No friction. Speaking now would interrupt. (Factors: a=2, b=1, c=1, d=1, e=2)",
  "score": 1.5
}
```

**Score 3.2 - Neutral:**
```json
{
  "reasoning": "Mild connection opportunity - both mentioned outdoor activities but not urgent. Conversation okay without intervention. Could speak but not necessary. (Factors: a=3, b=2, c=2, d=3, e=3)",
  "score": 3.2
}
```

**Score 4.5 - Strong Opportunity:**
```json
{
  "reasoning": "Both users explicitly have hiking in profiles AND discussing East Rock trail. Perfect shared interest match at ideal moment. Natural conversation fit. Trio hasn't spoken in 8 messages. (Factors: a=5, b=3, c=5, d=4, e=5)",
  "score": 4.5
}
```

## Your Task

Provide:
1. **Detailed reasoning** citing specific factors (a, b, c, d, e)
2. **Numeric score** between 1.0 and 5.0

## Output Format

```json
{
  "reasoning": "Your detailed analysis citing factors...",
  "score": 3.5
}
```

## Guidelines

- **Be honest and critical** - don't inflate scores
- **Cite specific evidence** from conversation
- **Consider all 5 factors** explicitly
- **Think about user experience** - would this interjection help or annoy?
- **Balance is key** - most thoughts should score 2.0-3.5
