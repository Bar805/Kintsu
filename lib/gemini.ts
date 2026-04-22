const FALLBACK_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-3-flash-preview',
    'gemini-3.1-pro-preview',
] as const

const MAX_RETRIES = 3

export interface GeminiCallOptions {
    /** System instruction text */
    systemPrompt?: string
    /** User/content prompt text */
    prompt: string
    /** JSON response schema (for structured output) */
    responseSchema?: any
    /** Response MIME type (defaults to "application/json") */
    responseMimeType?: string
    /** Temperature (defaults to 0.9) */
    temperature?: number
    /** Console log prefix for debugging */
    logPrefix?: string
}

interface GeminiRequestBody {
    system_instruction?: { parts: [{ text: string }] }
    contents: { role?: string; parts: [{ text: string }] }[]
    generationConfig: {
        temperature: number
        responseMimeType: string
        responseSchema?: any
    }
}

/**
 * Call Gemini API with model fallback on 503/429 errors.
 *
 * Tries models in order: gemini-2.5-flash → gemini-2.5-pro → gemini-3-flash-preview → gemini-3.1-pro-preview.
 * For 429 (rate limit), retries same model with exponential backoff up to 3 times before falling back.
 * For 503 (service unavailable) and other transient errors, immediately falls back to next model.
 */
export async function callGemini(options: GeminiCallOptions): Promise<string> {
    const {
        systemPrompt,
        prompt,
        responseSchema,
        responseMimeType = 'application/json',
        temperature = 0.9,
        logPrefix = '[gemini]',
    } = options

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) throw new Error('GOOGLE_API_KEY not set')

    const body: GeminiRequestBody = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature,
            responseMimeType,
            ...(responseSchema ? { responseSchema } : {}),
        },
    }

    if (systemPrompt) {
        body.system_instruction = { parts: [{ text: systemPrompt }] }
    }

    for (const model of FALLBACK_MODELS) {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

            let res: Response
            try {
                res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                })
            } catch (fetchErr) {
                console.warn(`${logPrefix} Network error with ${model} (attempt ${attempt + 1}/${MAX_RETRIES}):`, fetchErr)
                if (attempt < MAX_RETRIES - 1) {
                    await sleep(Math.pow(2, attempt + 1) * 1000)
                    continue
                }
                break // try next model
            }

            // 429: retry same model with backoff
            if (res.status === 429) {
                const wait = Math.pow(2, attempt + 1) * 1000
                console.warn(`${logPrefix} Rate limited on ${model} (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${wait}ms`)
                await sleep(wait)
                continue
            }

            // 503 or other server error: fall back to next model
            if (!res.ok) {
                const errText = await res.text()
                console.warn(`${logPrefix} ${model} returned ${res.status}, trying next model. Body: ${errText.slice(0, 200)}`)
                break // try next model
            }

            // Success path
            const textRaw = await res.text()
            let data
            try {
                data = JSON.parse(textRaw)
            } catch {
                console.error(`${logPrefix} Invalid JSON from ${model}. Raw:`, textRaw.slice(0, 300))
                break // try next model
            }

            const innerText = data?.candidates?.[0]?.content?.parts?.[0]?.text
            if (!innerText) {
                console.warn(`${logPrefix} Empty response from ${model}, trying next model`)
                break
            }

            if (model !== FALLBACK_MODELS[0]) {
                console.log(`${logPrefix} Succeeded with fallback model ${model}`)
            }

            return innerText
        }
    }

    throw new Error(`All Gemini models failed (${FALLBACK_MODELS.join(', ')})`)
}

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
}
