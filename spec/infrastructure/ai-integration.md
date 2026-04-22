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

## Retry Logic & Model Fallback

### Purpose
Handle Gemini API errors (429 rate limits, 503 service unavailable) gracefully with per-model retry and automatic model fallback.

### Shared Client (`lib/gemini.ts`)
All Gemini API calls use a single `callGemini()` function that provides:
- **Model fallback chain** on 503/server errors: gemini-2.5-flash → gemini-2.5-pro → gemini-3-flash-preview → gemini-3.1-pro-preview
- **Per-model retry** with exponential backoff (2s, 4s, 8s) for 429 rate limits
- **Network error retry** before falling back to next model
- Consistent JSON parsing and error logging

### Fallback Behavior
1. **429 (rate limit):** Retries same model with exponential backoff up to 3 times, then falls back to next model
2. **503 (service unavailable):** Immediately falls back to next model
3. **Network error:** Retries same model up to 3 times, then falls back
4. **Invalid/empty response:** Falls back to next model
5. **All models exhausted:** Throws `Error('All Gemini models failed (…)')`

### Configuration
- **Fallback models:** gemini-2.5-flash, gemini-2.5-pro, gemini-3-flash-preview, gemini-3.1-pro-preview
- **Max retries per model:** 3
- **Retry delays:** 2s, 4s, 8s (exponential backoff)
- **Retry on:** 429 status and network errors

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

| Use Case | Primary Model | Fallback Chain |
|----------|--------------|----------------|
| All Gemini calls | gemini-2.5-flash | → gemini-2.5-pro → gemini-3-flash-preview → gemini-3.1-pro-preview |

All calls use gemini-2.5-flash as primary. On failure, models are tried in the fallback chain order via `lib/gemini.ts`.

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

All models use the same base URL pattern:
```
https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}
```

Available models (in fallback order):
- `gemini-2.5-flash` (primary)
- `gemini-2.5-pro`
- `gemini-3-flash-preview`
- `gemini-3.1-pro-preview`

---

## Acceptance Criteria

- [ ] All Gemini calls use shared `callGemini()` from `lib/gemini.ts`
- [ ] Model fallback chain: flash → pro → gemini-3-flash → gemini-3.1-pro on 503/errors
- [ ] Per-model exponential backoff retry (3 attempts) for 429 rate limits
- [ ] JSON responses sanitized before parsing (newline fix)
- [ ] All AI logs prefixed with feature name
- [ ] Non-blocking AI calls catch errors and continue
- [ ] User-facing AI calls return graceful error messages
- [ ] API key loaded from environment variable
- [ ] Structured JSON outputs use responseSchema
- [ ] Temperature set appropriately (0.9 for creativity)
