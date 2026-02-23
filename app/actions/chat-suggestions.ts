'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ─── Helper: Admin client ────────────────────────────────────────────────────

function getAdminClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

// ─── Helper: Call Gemini ─────────────────────────────────────────────────────

async function callGemini(systemPrompt: string, userPrompt: string, schema?: any): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) throw new Error('GOOGLE_API_KEY not set')

    const body = JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
            temperature: 0.9,
            responseMimeType: 'application/json',
            ...(schema ? { responseSchema: schema } : {})
        },
    })

    // Retry with backoff for rate limits
    for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            }
        )

        if (res.status === 429) {
            const wait = Math.pow(2, attempt + 1) * 1000
            console.log(`Gemini rate limited (suggestions, attempt ${attempt + 1}/3), retrying in ${wait}ms...`)
            await new Promise(r => setTimeout(r, wait))
            continue
        }

        const text = await res.text()
        let data
        try {
            data = JSON.parse(text)
        } catch (e) {
            console.error('[chat-suggestions] Valid JSON check failed. Raw response:', text)
            throw new Error(`Gemini response not valid JSON: ${e instanceof Error ? e.message : String(e)}`)
        }
        let innerText = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (!innerText) throw new Error('No response from AI')
        return innerText
    }

    throw new Error('Gemini API rate limited after 3 retries')
}

// ─── 1. Generate Meetup Suggestion ──────────────────────────────────────────

const MEETUP_PROMPT = `
You are Kintsu, a social AI connecting people.
Both users have expressed interest in meeting. Based on their conversation topics, suggest 2 real places/activities where they could meet.

Rules:
- Pick REAL places that exist (restaurants, parks, climbing gyms, coffee shops, etc.)
- Choose places relevant to what they've been talking about
- Include the city/area if mentioned in conversation
- Keep the message warm and natural
`

export interface MeetupPlace {
    name: string
    category: string
    mapsQuery: string
}

export interface MeetupSuggestion {
    message: string
    places: MeetupPlace[]
}

export async function generateMeetupSuggestion(
    conversationId: string
): Promise<MeetupSuggestion | null> {
    const supabase = await createClient()
    const admin = getAdminClient()

    // Fetch recent messages
    const { data: messages } = await supabase
        .from('messages')
        .select('sender_id, content, is_ai_generated')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(20)

    if (!messages) return null

    // Fetch participant profiles
    const { data: participants } = await supabase
        .from('participants')
        .select('user_id')
        .eq('conversation_id', conversationId)

    if (!participants) return null

    const userIds = participants.map(p => p.user_id)
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, interests, bio')
        .in('id', userIds)

    const trioId = process.env.NEXT_PUBLIC_TRIO_USER_ID
    const chatLog = messages
        .reverse()
        .map(m => {
            if (m.sender_id === trioId || m.is_ai_generated) return `[Kintsu]: ${m.content}`
            const profile = profiles?.find(p => p.id === m.sender_id)
            return `[${profile?.first_name || 'User'}]: ${m.content}`
        })
        .join('\n')

    const profileInfo = profiles?.map(p =>
        `${p.first_name}: interests=${(p.interests || []).join(', ')}, bio=${p.bio || 'N/A'}`
    ).join('\n') || ''

    try {
        const meetupSchema = {
            type: "OBJECT",
            properties: {
                message: { type: "STRING" },
                places: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            name: { type: "STRING" },
                            category: { type: "STRING" },
                            mapsQuery: { type: "STRING" }
                        },
                        required: ["name", "category", "mapsQuery"]
                    }
                }
            },
            required: ["message", "places"]
        }

        const raw = await callGemini(
            MEETUP_PROMPT,
            `Profiles:\n${profileInfo}\n\nRecent chat:\n${chatLog}`,
            meetupSchema
        )
        const sanitized = raw.replace(/"(?:[^"\\]|\\.)*"/g, m => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r'))
        const parsed = JSON.parse(sanitized) as MeetupSuggestion

        // Mark meetup as suggested
        await admin
            .from('conversations')
            .update({ meetup_suggested: true })
            .eq('id', conversationId)

        // Send the meetup message via Trio
        if (trioId && parsed.message) {
            // Build the full message with place cards data encoded
            const placesJson = JSON.stringify(parsed.places)
            const fullContent = `${parsed.message}\n\n[MEETUP_PLACES]${placesJson}[/MEETUP_PLACES]`

            await admin
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: trioId,
                    content: fullContent,
                    is_ai_generated: true,
                })
        }

        return parsed
    } catch (err) {
        console.error('Failed to generate meetup:', err)
        return null
    }
}

// ─── 3. Mark Interested ─────────────────────────────────────────────────────

export async function markInterested(
    conversationId: string
): Promise<{ interested: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const admin = getAdminClient()

    // Get current conversation state
    const { data: conv } = await admin
        .from('conversations')
        .select('interested_user_ids, meetup_suggested, meetup_trigger_after')
        .eq('id', conversationId)
        .single()

    if (!conv) throw new Error('Conversation not found')

    const currentIds: string[] = conv.interested_user_ids || []
    const isCurrentlyInterested = currentIds.includes(user.id)

    if (isCurrentlyInterested) {
        // ── TOGGLE OFF ──
        const newIds = currentIds.filter(id => id !== user.id)
        const updatePayload: any = { interested_user_ids: newIds }

        // If meetup hasn't been sent yet, cancel the trigger
        if (!conv.meetup_suggested && conv.meetup_trigger_after) {
            updatePayload.meetup_trigger_after = null
        }

        await admin
            .from('conversations')
            .update(updatePayload)
            .eq('id', conversationId)

        return { interested: false }
    } else {
        // ── TOGGLE ON ──
        const newIds = [...currentIds, user.id]
        const updatePayload: any = { interested_user_ids: newIds }

        let shouldTriggerMeetup = false

        // If both users are now interested and no trigger yet
        if (newIds.length >= 2 && !conv.meetup_suggested) {
            updatePayload.meetup_suggested = true
            shouldTriggerMeetup = true
        }

        await admin
            .from('conversations')
            .update(updatePayload)
            .eq('id', conversationId)

        if (shouldTriggerMeetup) {
            // Fire in background
            generateMeetupSuggestion(conversationId).catch(err =>
                console.error('Immediate Meetup suggestion error:', err)
            )
        }

        return { interested: true }
    }
}

// ─── 4. Get Conversation Meta ───────────────────────────────────────────────

export interface ConversationMeta {
    timerExpiresAt: string | null
    isInterested: boolean
    meetupSuggested: boolean
}

export async function getConversationMeta(
    conversationId: string
): Promise<ConversationMeta> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const admin = getAdminClient()

    const { data: conv, error } = await admin
        .from('conversations')
        .select('timer_expires_at, interested_user_ids, meetup_suggested')
        .eq('id', conversationId)
        .single()

    if (error || !conv) {
        console.error('getConversationMeta error:', error?.message)
        // Return safe defaults instead of throwing
        return {
            timerExpiresAt: null,
            isInterested: false,
            meetupSuggested: false,
        }
    }

    return {
        timerExpiresAt: conv.timer_expires_at,
        isInterested: (conv.interested_user_ids || []).includes(user.id),
        meetupSuggested: conv.meetup_suggested || false,
    }
}
