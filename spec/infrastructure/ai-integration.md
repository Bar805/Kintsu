# AI Integration

## Purpose
Patterns for Google Gemini API integration: retry logic, structured outputs, error handling.

## Scope
- **In scope:** Gemini API patterns, retry logic, JSON handling
- **Out of scope:** AI prompts (see feature specs)

## Dependencies
- [Glossary](../shared/glossary.md) for AI terms
- [Conventions](../shared/conventions.md) for logging patterns

---

## Retry Logic (Exponential Backoff)

### Purpose
Handle Gemini API rate limits (429 errors) gracefully.

### Pattern
```typescript
for (let attempt = 0; attempt < 3; attempt++) {
  const response = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  })

  if (response.status === 429) {
    const wait = Math.pow(2, attempt + 1) * 1000  // 2s, 4s, 8s
    console.log(`Gemini rate limited (attempt ${attempt + 1}/3), retrying in ${wait}ms`)
    await new Promise(r => setTimeout(r, wait))
    continue
  }

  if (!response.ok) {
    const err = await response.text()
    console.error('Gemini API Error:', err)
    throw new Error(`API Error: ${response.status}`)
  }

  return await response.text()
}

throw new Error('Gemini API rate limited after 3 retries')
```

### Configuration
- **Max retries:** 3
- **Delays:** 2s, 4s, 8s (exponential backoff)
- **Only retry:** 429 status (rate limit)
- **Other errors:** Throw immediately

---

## Structured JSON Outputs

### Configuration
```typescript
const body = JSON.stringify({
  system_instruction: { parts: [{ text: systemPrompt }] },
  contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
  generationConfig: {
    temperature: 0.9,
    responseMimeType: 'application/json',
    responseSchema: {
      type: "OBJECT",
      properties: {
        reply: { type: "STRING" },
        readyToSearch: { type: "BOOLEAN" }
      },
      required: ["reply", "readyToSearch"]
    }
  }
})
```

### Response Parsing
```typescript
const text = await response.text()
let data
try {
  data = JSON.parse(text)
} catch (e) {
  console.error('[ai] Valid JSON check failed. Raw response:', text)
  throw new Error(`Gemini response not valid JSON: ${e.message}`)
}

const innerText = data.candidates?.[0]?.content?.parts?.[0]?.text
if (!innerText) throw new Error('No response from AI')

// Sanitize newlines in string values
const sanitized = innerText.replace(/"(?:[^"\\]|\\.)*"/g, m =>
  m.replace(/\n/g, '\\n').replace(/\r/g, '\\r')
)

const parsed = JSON.parse(sanitized)
```

### Why Sanitize?
Gemini sometimes includes literal newlines in JSON strings, causing parse errors. Sanitization escapes newlines within string values only.

---

## Model Selection

| Use Case | Model | Reason |
|----------|-------|--------|
| Chat (Kintsu) | gemini-2.5-flash | Speed, cost |
| Matchmaking | gemini-2.5-flash | Speed, cost |
| AI Interjections (evaluation) | gemini-2.5-flash | Speed prioritized |
| AI Interjections (generation) | gemini-2.5-flash | Speed prioritized |
| Meetup suggestions | gemini-2.5-flash | Speed, cost |
| Evaluation (scoring) | gemini-2.5-pro | Accuracy (future) |

**Current:** All use Flash for consistency. Pro reserved for future precision needs.

---

## Environment Variables

```bash
GOOGLE_API_KEY=AIzaSy...  # Server-only
```

**Usage:**
```typescript
const apiKey = process.env.GOOGLE_API_KEY
if (!apiKey) throw new Error('GOOGLE_API_KEY not set')
```

---

## Console Logging

### Pattern
```typescript
// Prefix all AI logs with feature name
console.log('[matchmaker] raw Gemini response:', text)
console.log('[ai] Trio Judge Result:', { score, reason })
console.log('[suggestions] Stage 1 — search queries:', result)
console.error('[ai] Valid JSON check failed. Raw response:', text)
```

### Prefixes
- `[matchmaker]` — Matchmaking AI calls
- `[ai]` — Trio interjection evaluations
- `[suggestions]` — Meetup suggestion pipeline
- `[places-api]` — Google Places API calls

---

## Error Handling

### Non-blocking AI Calls
```typescript
// In sendMessage()
try {
  const shouldSpeak = await evaluateConversationState(...)
  if (shouldSpeak) await generateTrioResponse(...)
} catch (e) {
  console.error('AI trigger error:', e)
  // Do NOT block message success
}
```

### User-facing AI Calls
```typescript
// In chatWithMatchmaker()
try {
  const parsed = JSON.parse(sanitized)
  return { reply: parsed.reply, readyToSearch: parsed.readyToSearch }
} catch (error) {
  console.error('Chat matchmaker error:', error)
  return {
    reply: "I'm having a moment — try again?",
    readyToSearch: false
  }
}
```

---

## API Endpoint

### Gemini 2.5 Flash
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apiKey}
```

### Gemini 2.5 Pro
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key={apiKey}
```

---

## Acceptance Criteria

- [ ] All Gemini calls use exponential backoff retry (3 attempts)
- [ ] JSON responses sanitized before parsing (newline fix)
- [ ] All AI logs prefixed with feature name
- [ ] Non-blocking AI calls catch errors and continue
- [ ] User-facing AI calls return graceful error messages
- [ ] API key loaded from environment variable
- [ ] Structured JSON outputs use responseSchema
- [ ] Temperature set appropriately (0.9 for creativity)
