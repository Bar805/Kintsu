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

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) throw new Error('GOOGLE_API_KEY not set')

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
            }),
        }
    )

    const data = await res.json()
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    // Strip markdown fencing if present
    return raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
}

// ─── 1. Generate Reply Suggestions ──────────────────────────────────────────

const SUGGESTIONS_PROMPT = `
You are Kintsu, a social AI that helps people connect.
Given the recent chat messages between two people, generate exactly 2 short reply suggestions for the current user.

Rules:
- Each suggestion should be 5-15 words
- Match the tone and topic of the conversation
- One can be playful/fun, the other more genuine/sincere
- Don't repeat what was already said
- Output JSON only, no markdown:
{"suggestions": ["suggestion 1", "suggestion 2"]}
`

export async function generateSuggestions(
    conversationId: string
): Promise<string[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Fetch recent messages (last 10)
    const { data: messages } = await supabase
        .from('messages')
        .select('sender_id, content, is_ai_generated')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(10)

    if (!messages || messages.length === 0) return []

    const trioId = process.env.NEXT_PUBLIC_TRIO_USER_ID
    const chatLog = messages
        .reverse()
        .map(m => {
            if (m.sender_id === trioId || m.is_ai_generated) return `[Kintsu]: ${m.content}`
            if (m.sender_id === user.id) return `[You]: ${m.content}`
            return `[Partner]: ${m.content}`
        })
        .join('\n')

    try {
        const raw = await callGemini(SUGGESTIONS_PROMPT, `Recent chat:\n${chatLog}`)
        const parsed = JSON.parse(raw)
        return parsed.suggestions?.slice(0, 2) || []
    } catch (err) {
        console.error('Failed to generate suggestions:', err)
        return []
    }
}

// ─── 2. Generate Meetup Suggestion ──────────────────────────────────────────

const MEETUP_PROMPT = `
You are Kintsu, a social AI connecting people.
Both users have expressed interest in meeting. Based on their conversation topics, suggest 2 real places/activities where they could meet.

Rules:
- Pick REAL places that exist (restaurants, parks, climbing gyms, coffee shops, etc.)
- Choose places relevant to what they've been talking about
- Include the city/area if mentioned in conversation
- Keep the message warm and natural
- Output JSON only, no markdown:
{
  "message": "Your encouraging message about them meeting up",
  "places": [
    {"name": "Place Name", "category": "Activity/Coffee/Food/etc", "mapsQuery": "Place Name City State"},
    {"name": "Place Name 2", "category": "Category", "mapsQuery": "Place Name 2 City State"}
  ]
}
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
        .select('id, full_name, interests, bio')
        .in('id', userIds)

    const trioId = process.env.NEXT_PUBLIC_TRIO_USER_ID
    const chatLog = messages
        .reverse()
        .map(m => {
            if (m.sender_id === trioId || m.is_ai_generated) return `[Kintsu]: ${m.content}`
            const profile = profiles?.find(p => p.id === m.sender_id)
            return `[${profile?.full_name || 'User'}]: ${m.content}`
        })
        .join('\n')

    const profileInfo = profiles?.map(p =>
        `${p.full_name}: interests=${(p.interests || []).join(', ')}, bio=${p.bio || 'N/A'}`
    ).join('\n') || ''

    try {
        const raw = await callGemini(
            MEETUP_PROMPT,
            `Profiles:\n${profileInfo}\n\nRecent chat:\n${chatLog}`
        )
        const parsed = JSON.parse(raw) as MeetupSuggestion

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

        // If both users are now interested and no trigger yet
        if (newIds.length >= 2 && !conv.meetup_suggested && !conv.meetup_trigger_after) {
            const { count } = await admin
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('conversation_id', conversationId)

            // Random 2-8 message delay
            const delay = Math.floor(Math.random() * 7) + 2
            updatePayload.meetup_trigger_after = (count || 0) + delay
        }

        await admin
            .from('conversations')
            .update(updatePayload)
            .eq('id', conversationId)

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

    const { data: conv } = await supabase
        .from('conversations')
        .select('timer_expires_at, interested_user_ids, meetup_suggested')
        .eq('id', conversationId)
        .single()

    if (!conv) throw new Error('Conversation not found')

    return {
        timerExpiresAt: conv.timer_expires_at,
        isInterested: (conv.interested_user_ids || []).includes(user.id),
        meetupSuggested: conv.meetup_suggested || false,
    }
}
