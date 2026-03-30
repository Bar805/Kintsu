# Cognitive Workflow Tuning Guide

**Version:** 1.0
**Last Updated:** 2026-03-30

---

## Overview

This guide explains how to tune the cognitive workflow hyperparameters to optimize Trio's behavior based on your goals and observed metrics.

**Configuration File:** `lib/cognitive-config.ts`

---

## Quick Start

### 1. Monitor Current Performance

Check your logs for these key metrics after 50-100 messages:

```bash
# Count total interjections
grep "\[cognitive\] ✓ WORKFLOW COMPLETE: Trio message posted" logs.txt | wc -l

# Count silent decisions
grep "\[cognitive\] ✓ WORKFLOW COMPLETE: Trio stays silent" logs.txt | wc -l

# View score distribution
grep "Phase 5 complete: Evaluation results" logs.txt
```

**Calculate interjection rate:**

```
Interjection Rate = (Messages Posted) / (Total User Messages) × 100%
```

**Target:** 5-10% (Trio speaks once every 10-20 user messages)

### 2. Identify Issues

| Problem                       | Symptom                                   | Fix                                       |
| ----------------------------- | ----------------------------------------- | ----------------------------------------- |
| **Trio talks too much**       | > 15% interjection rate                   | Increase `SELECTION_THRESHOLD` to 3.8-4.0 |
| **Trio rarely speaks**        | < 3% interjection rate                    | Decrease `SELECTION_THRESHOLD` to 3.0-3.2 |
| **Trio interrupts too soon**  | Speaks every 2-3 messages                 | Increase `RECENT_SPEECH_THRESHOLD` to 5   |
| **Trio misses opportunities** | Stays silent when obvious shared interest | Decrease `SELECTION_THRESHOLD` to 3.2     |
| **Slow performance**          | > 5 seconds latency                       | Use `EXPERIMENTAL_CONFIGS.FAST`           |
| **Poor quality thoughts**     | Generic or irrelevant                     | Use `EXPERIMENTAL_CONFIGS.QUALITY`        |

### 3. Make One Change at a Time

Edit `lib/cognitive-config.ts`:

```typescript
export const COGNITIVE_CONFIG = {
  // ... other settings ...

  SELECTION_THRESHOLD: 3.5, // Change this

  // ... other settings ...
};
```

### 4. Test and Measure

- Test with 20-30 messages
- Check logs for new interjection rate
- Review thought quality in Phase 4-6 logs
- Iterate

---

## Key Hyperparameters

### 🎯 SELECTION_THRESHOLD (Most Important)

**What it does:** Minimum motivation score (1.0-5.0) required for Trio to speak

**Effect on behavior:**

- ⬆️ Higher (4.0+): Trio only speaks when **very** confident
  - Pros: Less annoying, high-quality interjections
  - Cons: Misses some opportunities
- ⬇️ Lower (3.0-3.2): Trio speaks more frequently
  - Pros: More engagement, catches more opportunities
  - Cons: Risk of being too chatty

**Tuning process:**

1. **Start with 3.5** (default)
2. **Monitor for 50 messages:**
   - If interjection rate > 12%: Increase by 0.2
   - If interjection rate < 5%: Decrease by 0.2
3. **Check user feedback:**
   - Users complain "too chatty"? Increase by 0.3
   - Users want more help? Decrease by 0.2
4. **Converge to optimal:** Repeat until 5-10% rate

**Advanced:** Set different thresholds per conversation based on user preferences

---

### ⚖️ BALANCE_PENALTY_MULTIPLIER

**What it does:** Penalty applied when Trio spoke recently (< `RECENT_SPEECH_THRESHOLD` messages ago)

**Effect on behavior:**

- ⬇️ Lower (0.5-0.6): **Stronger** penalty, Trio less likely to speak again soon
- ⬆️ Higher (0.8-0.9): **Weaker** penalty, Trio can speak more frequently

**Example:**

```
Base score: 4.0
Penalty: 0.7 (30% reduction)
Final score: 4.0 × 0.7 = 2.8 (below threshold 3.5, stays silent)
```

**Tuning:**

- Trio interrupting conversations? **Decrease to 0.6** (stronger penalty)
- Trio missing follow-ups? **Increase to 0.8** (weaker penalty)

---

### 📏 RECENT_SPEECH_THRESHOLD

**What it does:** Number of messages that counts as "recent" for penalty

**Effect on behavior:**

- ⬆️ Higher (5-7): Longer "cooldown" before Trio can speak again
- ⬇️ Lower (2-3): Shorter cooldown, more frequent speaking

**Tuning:**

- Users find Trio too frequent? **Increase to 5-7**
- Conversations move fast and Trio lags? **Decrease to 2-3**

---

### 🔥 SYSTEM2_COUNT

**What it does:** Number of System 2 (deliberate) thoughts to generate

**Effect on behavior:**

- ⬆️ Higher (3-4): More diverse thoughts, better chance of good match
  - Cost: More API calls, slower
- ⬇️ Lower (1): Faster, cheaper
  - Cost: Less diversity

**Tuning:**

- Quality issues? **Increase to 3**
- Performance issues? **Decrease to 1**

---

### 🧠 MEMORY_WINDOW_SIZE

**What it does:** Number of recent messages stored in short-term memory

**Effect on behavior:**

- ⬆️ Higher (12-15): More context, better understanding of conversation flow
  - Cost: More storage, slower saliency updates
- ⬇️ Lower (5-8): Faster, but less context

**Tuning:**

- Trio missing context? **Increase to 12-15**
- Performance issues? **Decrease to 5-7**

---

### 📉 INTEREST_DECAY & MESSAGE_DECAY

**What they do:** How quickly saliency scores decay over time

**Effect on behavior:**

- ⬆️ Higher (0.98-0.99): Interests/messages stay relevant longer
  - Good for slow conversations
- ⬇️ Lower (0.93-0.95): Faster decay, more reactive to recent messages
  - Good for fast-moving conversations

**Tuning:**

- Trio stuck on old topics? **Decrease MESSAGE_DECAY to 0.93**
- Trio forgetting important details? **Increase INTEREST_DECAY to 0.98**

---

## Monitoring & Metrics

### Analytics Queries

**1. Interjection Rate by Category**

```sql
SELECT
  thought_category,
  COUNT(*) as count,
  AVG(motivation_score) as avg_score
FROM messages
WHERE is_ai_generated = true
  AND thought_category IS NOT NULL
GROUP BY thought_category
ORDER BY count DESC;
```

**2. Selection Rate (% thoughts that get selected)**

```sql
SELECT
  COUNT(*) FILTER (WHERE was_selected = true) * 100.0 / COUNT(*) as selection_rate_pct
FROM trio_thoughts;
```

**3. Average Scores by System Type**

```sql
SELECT
  system_type,
  AVG(motivation_score) as avg_motivation,
  AVG(base_score) as avg_base
FROM trio_thoughts
GROUP BY system_type;
```

**4. Top Stimuli Types**

```sql
SELECT
  stimulus_type,
  COUNT(*) as count
FROM thought_stimuli ts
JOIN trio_thoughts t ON t.id = ts.thought_id
WHERE t.was_selected = true
GROUP BY stimulus_type
ORDER BY count DESC;
```

### Log Analysis

**Extract scores for analysis:**

```bash
grep "Phase 5 complete" logs.txt | \
  grep -oP '"final": "\K[0-9.]+' > scores.txt

# Plot histogram in Python
python3 -c "
import matplotlib.pyplot as plt
scores = [float(x) for x in open('scores.txt')]
plt.hist(scores, bins=20)
plt.axvline(3.5, color='r', label='Threshold')
plt.xlabel('Motivation Score')
plt.ylabel('Count')
plt.legend()
plt.savefig('score_distribution.png')
"
```

**Check thought categories:**

```bash
grep "Thought categories:" logs.txt | \
  sed 's/.*categories: //' | \
  tr ',' '\n' | \
  sort | uniq -c | sort -nr
```

---

## A/B Testing

### Setup Different Configurations

**Option 1: Environment Variable**

```bash
# .env.local
COGNITIVE_MODE=CHATTY  # or SELECTIVE, FAST, QUALITY
```

**Option 2: Per-Conversation Override**

```typescript
// Add to conversations table
ALTER TABLE conversations
ADD COLUMN cognitive_mode TEXT DEFAULT 'default';

// In cognitive-workflow.ts
const mode = conversation.cognitive_mode || 'default'
const config = mode === 'CHATTY' ? EXPERIMENTAL_CONFIGS.CHATTY : COGNITIVE_CONFIG
```

### Test Scenarios

**1. Chatty vs Selective** (User preference test)

- 50% users: `CHATTY` mode (threshold 3.0)
- 50% users: `SELECTIVE` mode (threshold 4.0)
- Measure: User satisfaction, conversation continuation rate

**2. Fast vs Quality** (Performance vs accuracy)

- Group A: `FAST` mode (fewer API calls)
- Group B: `QUALITY` mode (more context)
- Measure: Latency, thought relevance score

**3. Threshold Sweep** (Find optimal)

- Test thresholds: 3.0, 3.2, 3.5, 3.8, 4.0
- 20 conversations each
- Measure: Interjection rate, user engagement

---

## Recommended Tuning Process

### Week 1: Baseline

1. Use default `COGNITIVE_CONFIG`
2. Collect 100+ conversations
3. Calculate baseline metrics:
   - Interjection rate: \_\_\_\_%
   - Avg motivation score: \_\_\_\_
   - User satisfaction: \_\_\_\_

### Week 2: Threshold Tuning

1. Adjust `SELECTION_THRESHOLD` based on baseline:
   - Too high (>15%) → increase to 3.8
   - Too low (<5%) → decrease to 3.2
2. Test for 50 conversations
3. Re-measure interjection rate

### Week 3: Balance Tuning

1. Review logs: Is Trio speaking too soon after previous message?
2. Adjust `BALANCE_PENALTY_MULTIPLIER`:
   - Too frequent → decrease to 0.6
   - Missing follow-ups → increase to 0.8
3. Adjust `RECENT_SPEECH_THRESHOLD` if needed

### Week 4: Quality Tuning

1. Review thought quality in logs
2. If thoughts are generic:
   - Increase `SYSTEM2_COUNT` to 3
   - Increase `SYSTEM2_TOP_INTERESTS` to 8
3. If too slow:
   - Use `FAST` mode
   - Reduce `MEMORY_WINDOW_SIZE` to 7

### Week 5+: Fine-tuning

- Adjust decay rates based on conversation dynamics
- Tune temperature settings for creativity
- A/B test experimental configs

---

## Common Patterns & Solutions

### Pattern 1: Trio Always Silent in New Conversations

**Symptom:** First 5-10 messages always score below threshold

**Cause:** Not enough saliency built up yet

**Solution:**

- Decrease `INITIAL_INTEREST_SALIENCY` from 0.5 to 0.7 (higher initial relevance)
- OR add special "early conversation" boost in Phase 5

```typescript
// In evaluateThoughts()
const isEarlyConversation = messagesSinceTrioSpoke > 15;
if (isEarlyConversation) {
  motivation_score *= 1.15; // 15% boost for early convos
}
```

### Pattern 2: System 1 Never Selected

**Symptom:** All selected thoughts are System 2

**Cause:** System 1 thoughts score too low

**Solution:**

- Increase `SYSTEM1_TEMPERATURE` to 0.9 (more creative)
- OR add System 1 bias: `if (thought.system_type === 'system1') score *= 1.1`

### Pattern 3: Same Category Repeated

**Symptom:** Trio always picks `shared_interest`, never `friction_reduction`

**Cause:** Certain categories naturally score higher

**Solution:**

- Add category diversity bonus
- Track last N selected categories, penalize repeats

### Pattern 4: Scores Always Below Threshold

**Symptom:** 95%+ thoughts score < 3.5

**Cause:** Evaluation too harsh OR threshold too high

**Solution:**

- Check average scores in analytics
- If avg < 3.0: Evaluation is too harsh (LLM issue or poor context)
- If avg = 3.2-3.4: Lower threshold to 3.2

---

## Advanced: Dynamic Threshold

Adjust threshold based on conversation state:

```typescript
export function getDynamicThreshold(conversationId: string): number {
  const baseThreshold = COGNITIVE_CONFIG.SELECTION_THRESHOLD;

  // Lower threshold for quiet conversations
  if (messagesSinceLastMessage > 60) {
    // 1 hour
    return baseThreshold - 0.5; // More eager to speak
  }

  // Higher threshold for very active conversations
  if (messagesInLast5Min > 10) {
    return baseThreshold + 0.3; // More selective
  }

  // Lower threshold if no shared interests identified yet
  if (!hasIdentifiedSharedInterests) {
    return baseThreshold - 0.3;
  }

  return baseThreshold;
}
```

---

## Summary

**Most Important Parameters (tune these first):**

1. ⭐ `SELECTION_THRESHOLD` (3.0-4.0) - Controls how often Trio speaks
2. ⭐ `BALANCE_PENALTY_MULTIPLIER` (0.6-0.9) - Controls cooldown strength
3. ⭐ `RECENT_SPEECH_THRESHOLD` (2-7) - Controls cooldown duration

**Quick Modes:**

- Want Trio to speak more? Use `CHATTY` mode
- Want Trio more selective? Use `SELECTIVE` mode
- Need better performance? Use `FAST` mode
- Need better quality? Use `QUALITY` mode

**Monitoring:**

- Track interjection rate (target: 5-10%)
- Review thought scores in logs
- Check user feedback/satisfaction
- Run analytics queries weekly

**Iteration:**

1. Change ONE parameter at a time
2. Test with 20-30 messages minimum
3. Measure impact
4. Repeat

---

## See Also

- [cognitive-config.ts](../lib/cognitive-config.ts) - Configuration file
- [AI Interjections Spec](./features/ai-interjections.md) - Workflow documentation
- [Trio Thought Model](./data-models/trio-thought.md) - Database schema for analytics
