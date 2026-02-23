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

// Stage 1 prompt: Extract search queries from the conversation
const MEETUP_SEARCH_PROMPT = `
You are Kintsu, a social AI. Analyze the conversation between two users and extract what kind of places they might enjoy meeting at.

Rules:
- Generate exactly 2 specific Google Maps search queries based on their interests and conversation topics
- If a city, neighborhood, or area is mentioned, include it in locationContext
- If no location is mentioned, set locationContext to an empty string
- Queries should be specific activity types (e.g. "bouldering gym", "board game cafe", "jazz bar") not generic ("fun place")
`

// Stage 3 prompt: Synthesize the final message using verified venues
const MEETUP_SYNTHESIZE_PROMPT = `
You are Kintsu, a social AI connecting people.
Both users have expressed interest in meeting. You have been given VERIFIED, real places from Google Maps.

Rules:
- Write a warm, natural message suggesting these specific venues
- Reference the actual venue names provided to you
- Do NOT invent or suggest any places that are not in the provided venue list
- Keep the message concise and fun
`

export interface MeetupPlace {
    name: string
    category: string
    mapsQuery: string
    googleMapsUri?: string
    address?: string
}

export interface MeetupSuggestion {
    message: string
    places: MeetupPlace[]
}

// ─── Helper: Resolve venue via Google Places API ────────────────────────────

async function resolveVenueWithPlacesAPI(
    query: string
): Promise<{ displayName: string; formattedAddress: string; googleMapsUri: string; primaryType: string } | null> {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) return null

    try {
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.googleMapsUri,places.primaryType',
            },
            body: JSON.stringify({ textQuery: query }),
        })

        if (!res.ok) {
            console.error('[places-api] HTTP error:', res.status, await res.text())
            return null
        }

        const data = await res.json()
        const place = data.places?.[0]
        if (!place) return null

        return {
            displayName: place.displayName?.text || '',
            formattedAddress: place.formattedAddress || '',
            googleMapsUri: place.googleMapsUri || '',
            primaryType: place.primaryType || '',
        }
    } catch (err) {
        console.error('[places-api] Fetch failed:', err)
        return null
    }
}

// ─── Main: 3-Stage RAG Pipeline ─────────────────────────────────────────────

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
        // ── STAGE 1: Extract search queries from conversation ───────────
        const searchSchema = {
            type: "OBJECT",
            properties: {
                queries: {
                    type: "ARRAY",
                    description: "Exactly 2 specific Google Maps search queries",
                    items: { type: "STRING" }
                },
                locationContext: {
                    type: "STRING",
                    description: "City/area mentioned in conversation, or empty string"
                }
            },
            required: ["queries", "locationContext"]
        }

        const searchRaw = await callGemini(
            MEETUP_SEARCH_PROMPT,
            `Profiles:\n${profileInfo}\n\nRecent chat:\n${chatLog}`,
            searchSchema
        )
        const searchSanitized = searchRaw.replace(/"(?:[^"\\]|\\.)*"/g, m => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r'))
        const searchResult = JSON.parse(searchSanitized) as { queries: string[]; locationContext: string }

        console.log('[meetup] Stage 1 — search queries:', searchResult)

        // ── STAGE 2: Resolve venues via Google Places API ───────────────
        const locationSuffix = searchResult.locationContext ? ` in ${searchResult.locationContext}` : ''
        const placePromises = searchResult.queries.slice(0, 2).map(q =>
            resolveVenueWithPlacesAPI(`${q}${locationSuffix}`)
        )
        const resolvedPlaces = await Promise.all(placePromises)

        // Build verified places array
        const verifiedPlaces: MeetupPlace[] = resolvedPlaces
            .filter((p): p is NonNullable<typeof p> => p !== null)
            .map(p => ({
                name: p.displayName,
                category: p.primaryType.replace(/_/g, ' '),
                mapsQuery: `${p.displayName} ${p.formattedAddress}`,
                googleMapsUri: p.googleMapsUri,
                address: p.formattedAddress,
            }))

        console.log('[meetup] Stage 2 — verified places:', verifiedPlaces.map(p => p.name))

        if (verifiedPlaces.length === 0) {
            console.warn('[meetup] No venues found via Places API, skipping suggestion')
            return null
        }

        // ── STAGE 3: Synthesize final message with verified venues ──────
        const venueListForAI = verifiedPlaces.map(p =>
            `- ${p.name} (${p.category}) at ${p.address}`
        ).join('\n')

        const synthesizeSchema = {
            type: "OBJECT",
            properties: {
                message: { type: "STRING", description: "A warm, fun message suggesting these exact venues" }
            },
            required: ["message"]
        }

        const synthRaw = await callGemini(
            MEETUP_SYNTHESIZE_PROMPT,
            `Profiles:\n${profileInfo}\n\nRecent chat:\n${chatLog}\n\nVERIFIED VENUES:\n${venueListForAI}`,
            synthesizeSchema
        )
        const synthSanitized = synthRaw.replace(/"(?:[^"\\]|\\.)*"/g, m => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r'))
        const synthResult = JSON.parse(synthSanitized) as { message: string }

        const result: MeetupSuggestion = {
            message: synthResult.message,
            places: verifiedPlaces,
        }

        // Mark meetup as suggested
        await admin
            .from('conversations')
            .update({ meetup_suggested: true })
            .eq('id', conversationId)

        // Send the meetup message via Trio
        if (trioId && result.message) {
            const placesJson = JSON.stringify(result.places)
            const fullContent = `${result.message}\n\n[MEETUP_PLACES]${placesJson}[/MEETUP_PLACES]`

            await admin
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: trioId,
                    content: fullContent,
                    is_ai_generated: true,
                })
        }

        return result
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
