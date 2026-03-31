# Cognitive Workflow Tuning Guide

**Config File:** `lib/cognitive-config.ts`

---

## Quick Troubleshooting

| Problem | Symptom | Fix |
|---------|---------|-----|
| Trio talks too much | > 15% interjection rate | Increase `SELECTION_THRESHOLD` to 3.8-4.0 |
| Trio rarely speaks | < 3% interjection rate | Decrease `SELECTION_THRESHOLD` to 3.0-3.2 |
| Trio interrupts too soon | Speaks every 2-3 messages | Increase `RECENT_SPEECH_THRESHOLD` to 5 |
| Slow performance | > 5s latency | Use `EXPERIMENTAL_CONFIGS.FAST` |
| Poor quality thoughts | Generic/irrelevant | Use `EXPERIMENTAL_CONFIGS.QUALITY` |

**Target interjection rate:** 5-10% (Trio speaks once per 10-20 user messages)

---

## Parameter Reference

### SELECTION_THRESHOLD (Most Important)

- **Range:** 1.0-5.0 | **Default:** 3.5
- **Controls:** Minimum motivation score required for Trio to speak
- **Higher (4.0+):** Trio only speaks when very confident → less chatty, may miss opportunities
- **Lower (3.0-3.2):** Trio speaks more frequently → more engagement, risk of annoyance

### BALANCE_PENALTY_MULTIPLIER

- **Range:** 0.5-0.9 | **Default:** 0.7
- **Controls:** Penalty applied when Trio spoke recently
- **Lower (0.5-0.6):** Stronger penalty → longer cooldown between messages
- **Higher (0.8-0.9):** Weaker penalty → Trio can speak more frequently
- **Example:** Base score 4.0 × 0.7 penalty = 2.8 (below threshold, stays silent)

### RECENT_SPEECH_THRESHOLD

- **Range:** 2-7 | **Default:** 3
- **Controls:** Number of messages that count as "recent" for penalty
- **Higher (5-7):** Longer cooldown period
- **Lower (2-3):** Shorter cooldown, more frequent speaking

### SYSTEM2_COUNT

- **Range:** 1-4 | **Default:** 2
- **Controls:** Number of deliberate thoughts to generate
- **Higher (3-4):** More diverse thoughts, better matches → more API calls, slower
- **Lower (1):** Faster, cheaper → less diversity

### MEMORY_WINDOW_SIZE

- **Range:** 5-15 | **Default:** 10
- **Controls:** Recent messages stored in short-term memory
- **Higher (12-15):** More context → slower saliency updates
- **Lower (5-8):** Faster → less context

### INTEREST_DECAY & MESSAGE_DECAY

- **Range:** 0.93-0.99 | **Defaults:** 0.95, 0.95
- **Controls:** How quickly saliency scores decay over time
- **Higher (0.98-0.99):** Interests stay relevant longer → good for slow conversations
- **Lower (0.93-0.95):** Faster decay, more reactive to recent messages → good for fast conversations

---

## Monitoring

```bash
# Interjection rate
grep "\[cognitive\] ✓ WORKFLOW COMPLETE: Trio message posted" logs.txt | wc -l

# Silent decisions
grep "\[cognitive\] ✓ WORKFLOW COMPLETE: Trio stays silent" logs.txt | wc -l
```

---

## Quick Modes

- `EXPERIMENTAL_CONFIGS.CHATTY` — Trio speaks more (threshold 3.0)
- `EXPERIMENTAL_CONFIGS.SELECTIVE` — Trio more selective (threshold 4.0)
- `EXPERIMENTAL_CONFIGS.FAST` — Fewer API calls, lower latency
- `EXPERIMENTAL_CONFIGS.QUALITY` — More context, better thoughts

---

## Tuning Process

1. Start with defaults, collect 50+ messages
2. Check interjection rate — adjust `SELECTION_THRESHOLD` first
3. If interrupting too soon — adjust `BALANCE_PENALTY_MULTIPLIER` and `RECENT_SPEECH_THRESHOLD`
4. If quality issues — adjust `SYSTEM2_COUNT` or use `QUALITY` mode
5. Change ONE parameter at a time, test with 20-30 messages
