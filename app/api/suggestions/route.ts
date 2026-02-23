import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// ─── Helper: Call Gemini ─────────────────────────────────────────────────────

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) throw new Error('GOOGLE_API_KEY not set')

    const body = JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 512,
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    suggestions: {
                        type: "ARRAY",
                        description: "Exactly 2 text message suggestions",
                        items: {
                            type: "STRING"
                        }
                    }
                },
                required: ["suggestions"]
            }
        },
    })

    for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
        )
        if (res.status === 429) {
            const wait = Math.pow(2, attempt + 1) * 1000
            console.warn(`[suggestions] Gemini rate limited (attempt ${attempt + 1}/3), retrying in ${wait}ms`)
            await new Promise(r => setTimeout(r, wait))
            continue
        }
        if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`)
        const text = await res.text()
        let data
        try {
            data = JSON.parse(text)
        } catch (e) {
            console.error('[suggestions] Valid JSON check failed. Raw response:', text)
            throw new Error(`Gemini response not valid JSON (len=${text.length}): ${e instanceof Error ? e.message : String(e)}`)
        }

        let innerText = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (!innerText) throw new Error('No response from AI')
        return innerText
    }
    throw new Error('Gemini API rate limited after 3 retries')
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

const ICEBREAKER_PROMPT = `
You are Kintsu, a social AI that helps people connect.
Two people have just been matched and their chat is empty. Generate exactly 2 opening messages that the first user could send to start the conversation.

Rules:
- Each message should be 5-15 words
- Sound natural and conversational, like a real first message — not formal
- Draw on any shared interests or profile details if available
- One can be playful/curious, the other more warm/genuine
- Output JSON only, no markdown:
{"suggestions": ["message 1", "message 2"]}
`

const REPLY_PROMPT = `
You are Kintsu, a social AI that helps people connect.
Generate exactly 2 reply suggestions for the current user, in their own texting style.

Rules:
- Each suggestion should be 5-15 words
- Match the tone and topic of the conversation
- Mirror the user's own texting style based on their previous messages (casual/formal, short/long, emoji usage, punctuation style, etc.)
- If the user has few prior messages, default to natural and conversational
- One can be playful/fun, the other more genuine/sincere
- Don't repeat what was already said
- Output JSON only, no markdown:
{"suggestions": ["suggestion 1", "suggestion 2"]}
`

// ─── GET /api/suggestions?conversationId=xxx ──────────────────────────────────

export async function GET(req: NextRequest) {
    const conversationId = new URL(req.url).searchParams.get('conversationId')
    if (!conversationId) {
        return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        console.error('[suggestions] Auth failed:', authError?.message)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a participant (prevents data leaks)
    const { data: membership } = await supabase
        .from('participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .single()
    if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const trioId = process.env.NEXT_PUBLIC_TRIO_USER_ID

    // Fetch last 15 messages
    const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('sender_id, content, is_ai_generated')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(15)

    if (msgError) {
        console.error('[suggestions] Failed to fetch messages:', msgError.message)
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    const humanMessages = (messages || []).filter(
        m => !m.is_ai_generated && m.sender_id !== trioId
    )

    try {
        let raw: string

        if (humanMessages.length === 0) {
            // ── ICEBREAKER MODE ──────────────────────────────────────────────
            const { data: participants } = await supabase
                .from('participants')
                .select('user_id')
                .eq('conversation_id', conversationId)

            const userIds = (participants || []).map(p => p.user_id)

            // Guard: .in('id', []) generates invalid SQL in Postgres
            let profileContext = ''
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('first_name, interests, bio')
                    .in('id', userIds)

                profileContext = (profiles || [])
                    .map(p => `${p.first_name}: interests=${(p.interests || []).join(', ')}${p.bio ? `, bio=${p.bio}` : ''}`)
                    .join('\n')
            }

            const userPrompt = profileContext
                ? `User profiles:\n${profileContext}\n\nGenerate 2 icebreaker opening messages.`
                : 'Generate 2 natural icebreaker opening messages.'

            raw = await callGemini(ICEBREAKER_PROMPT, userPrompt)
        } else {
            // ── REPLY MODE ───────────────────────────────────────────────────
            const orderedMessages = [...(messages || [])].reverse()

            const userOwnMessages = orderedMessages
                .filter(m => m.sender_id === user.id)
                .map(m => m.content)

            const chatLog = orderedMessages.map(m => {
                if (m.sender_id === trioId || m.is_ai_generated) return `[Kintsu]: ${m.content}`
                if (m.sender_id === user.id) return `[You]: ${m.content}`
                return `[Partner]: ${m.content}`
            }).join('\n')

            const styleNote = userOwnMessages.length >= 2
                ? `\n\nUser's previous messages for style reference:\n${userOwnMessages.slice(-5).map(m => `- "${m}"`).join('\n')}`
                : ''

            raw = await callGemini(REPLY_PROMPT, `Recent chat:\n${chatLog}${styleNote}`)
        }

        console.log('[suggestions] Gemini raw:', raw)
        const parsed = JSON.parse(raw)
        return NextResponse.json({ suggestions: parsed.suggestions?.slice(0, 2) || [] })
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        console.error('[suggestions] Failed:', detail)
        const isRateLimit = detail.includes('rate limited') || detail.includes('429')
        return NextResponse.json(
            { error: isRateLimit ? 'rate_limited' : 'Failed to generate suggestions', detail },
            { status: isRateLimit ? 429 : 500 }
        )
    }
}
