'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────────────

export type MatchRequest = {
    id: string
    requester_id: string
    status: 'chatting' | 'searching' | 'pending_approval' | 'accepted' | 'declined' | 'expired' | 'no_candidates' | 'error'
    matched_user_id: string | null
    declined_user_ids: string[]
    conversation_history: { role: 'user' | 'model'; content: string }[]
    match_reason: string | null
    intro_message: string | null
    conversation_id: string | null
    created_at: string
    updated_at: string
    expires_at: string
    error_message?: string | null
}

type ChatAIResponse = {
    reply: string
    readyToSearch: boolean
}

type MatchAIResponse = {
    matchId: string
    matchReason: string
    introMessage: string
}

// ─── AI Prompts ──────────────────────────────────────────────────────────────

const CHAT_SYSTEM_PROMPT = `
You are Kintsu, a warm and perceptive mutual friend helping someone find a new connection.

Your ONLY job is to understand what kind of person they want to meet. You do NOT have access to any candidate list.

STRICT RULES:
1. Ask exactly 2 follow-up questions, one per reply, to understand what they want.
2. On your 3RD reply (after the user has answered both questions), you MUST:
   - Briefly summarize what they're looking for
   - Set readyToSearch to TRUE
   - End with a clear farewell like "Let me scan my network — I'll ping you when I find someone!"
3. NEVER send more than 3 total replies. Your 3rd reply ALWAYS has readyToSearch: true.
4. Be casual, friendly, and concise (2-3 sentences max per reply).
5. Focus on the TYPE of person: interests, vibe, what they want to do together.
6. NEVER mention specific people, names, or candidate counts.

Count your replies in the conversation history to know which reply number you're on.
If this is already your 3rd (or later) reply, you MUST set readyToSearch to true.
`

const MATCH_SYSTEM_PROMPT = `
You are Kintsu, matching people based on compatibility.

The user described what they're looking for in this conversation:
{CONVERSATION_HISTORY}

Here are the available candidates:
{CANDIDATES_LIST}

Pick the BEST single match. Consider personality compatibility, shared interests, and what the requester explicitly asked for.

Write a matchReason shown on a card to the matched person. Use exactly 3 SHORT bullet points (max 8 words each). Be punchy and specific, not generic. Example: "• Both obsessed with sourdough\n• You're the climbing partner they need\n• Shared love of late-night philosophy"

Also write an introMessage that Kintsu posts in the chat once both people accept. Address BOTH people together (e.g. "You two...", "Both of you..."). Mention what they share. Speak as Kintsu — a single friend who knows them both. Never say "we". Keep it warm, casual, and under 2 sentences.
`

// ─── Helper: Get Admin Supabase Client ───────────────────────────────────────

function getAdminClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

// ─── Helper: Call Gemini API ─────────────────────────────────────────────────

async function callGemini(systemPrompt: string, history: { role: string; content: string }[], schema?: any): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

    const mappedHistory = history.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content || " " }] // Fallback if m.content was somehow saved as undefined
    }))

    const bodyObj: any = {
        generationConfig: {
            responseMimeType: 'application/json',
            ...(schema ? { responseSchema: schema } : {})
        }
    }

    if (mappedHistory.length === 0) {
        // For findMatch where there's no chat history, send the prompt as the user message
        bodyObj.contents = [{ role: 'user', parts: [{ text: systemPrompt }] }]
    } else {
        // For chatWithMatchmaker, use system_instruction and pass the alternating history
        bodyObj.system_instruction = { parts: [{ text: systemPrompt }] }
        bodyObj.contents = mappedHistory
    }

    const body = JSON.stringify(bodyObj)

    // Retry with backoff for rate limits
    for (let attempt = 0; attempt < 3; attempt++) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        })

        if (response.status === 429) {
            const wait = Math.pow(2, attempt + 1) * 1000 // 2s, 4s, 8s
            console.log(`Gemini rate limited (attempt ${attempt + 1}/3), retrying in ${wait}ms...`)
            await new Promise(r => setTimeout(r, wait))
            continue
        }

        if (!response.ok) {
            const err = await response.text()
            console.error('Gemini API Error:', err)
            throw new Error(`API Error: ${response.status}`)
        }

        const text = await response.text()
        console.log('[matchmaker] raw Gemini response:', text)
        let data
        try {
            data = JSON.parse(text)
        } catch (e) {
            console.error('[matchmaker] Valid JSON check failed. Raw response:', text)
            throw new Error(`Gemini response not valid JSON: ${e instanceof Error ? e.message : String(e)}`)
        }

        let innerText = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (!innerText) throw new Error('No response from AI')

        // Gemini structured outputs sometimes return the object as a stringified property
        // so we just return the raw string and let the caller `JSON.parse` it as normal
        return innerText
    }

    throw new Error('Gemini API rate limited after 3 retries')
}

// ─── 1. getActiveMatchRequest ────────────────────────────────────────────────
// Returns the user's current active match request (if any)

export async function getActiveMatchRequest(): Promise<MatchRequest | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const adminClient = getAdminClient()

    // Check for expired requests first and expire them
    await adminClient
        .from('match_requests')
        .update({ status: 'expired' })
        .eq('requester_id', user.id)
        .in('status', ['chatting', 'searching', 'pending_approval'])
        .lt('expires_at', new Date().toISOString())

    // Check for stuck searching requests (longer than 5 minutes)
    // This handles cases where findMatch() failed without updating status
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    await adminClient
        .from('match_requests')
        .update({
            status: 'error',
            error_message: 'Match search timed out. Please try again.'
        })
        .eq('requester_id', user.id)
        .eq('status', 'searching')
        .lt('updated_at', fiveMinutesAgo)

    const { data } = await supabase
        .from('match_requests')
        .select('*')
        .eq('requester_id', user.id)
        .in('status', ['chatting', 'searching', 'pending_approval', 'error'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    return data as MatchRequest | null
}

// ─── 2. getPendingMatchForUser ───────────────────────────────────────────────
// Returns pending match requests where current user is the proposed match

export async function getPendingMatchForUser(): Promise<(MatchRequest & { requester_profile: any }) | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Expire old requests
    const adminClient = getAdminClient()
    await adminClient
        .from('match_requests')
        .update({ status: 'expired' })
        .eq('matched_user_id', user.id)
        .eq('status', 'pending_approval')
        .lt('expires_at', new Date().toISOString())

    const { data: request } = await supabase
        .from('match_requests')
        .select('*')
        .eq('matched_user_id', user.id)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (!request) return null

    // Fetch requester profile for the character card
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, first_name, age, gender, avatar_url, bio, interests, identity_chips, ai_summary')
        .eq('id', request.requester_id)
        .single()

    return { ...request, requester_profile: profile } as any
}

// ─── 3. chatWithMatchmaker ───────────────────────────────────────────────────
// Handles the conversational phase (AI asks follow-up questions)

export async function chatWithMatchmaker(
    userMessage: string,
    requestId?: string
): Promise<{ reply: string; readyToSearch: boolean; requestId: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const adminClient = getAdminClient()
    let matchRequest: MatchRequest | null = null

    // Load or create match request
    if (requestId) {
        const { data } = await supabase
            .from('match_requests')
            .select('*')
            .eq('id', requestId)
            .eq('requester_id', user.id)
            .single()
        matchRequest = data as MatchRequest | null
    }

    if (!matchRequest) {
        // Create new request
        const { data, error } = await adminClient
            .from('match_requests')
            .insert({
                requester_id: user.id,
                status: 'chatting',
                conversation_history: [],
            })
            .select()
            .single()

        if (error) throw new Error('Failed to create match request')
        matchRequest = data as MatchRequest
    }

    // Build history with new message
    const history = [
        ...matchRequest.conversation_history,
        { role: 'user' as const, content: userMessage }
    ]

    try {
        const chatSchema = {
            type: "OBJECT",
            properties: {
                reply: { type: "STRING" },
                readyToSearch: { type: "BOOLEAN" }
            },
            required: ["reply", "readyToSearch"]
        }

        const raw = await callGemini(CHAT_SYSTEM_PROMPT, history, chatSchema)
        const sanitized = raw.replace(/"(?:[^"\\]|\\.)*"/g, m => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r'))
        const parsed = JSON.parse(sanitized) as ChatAIResponse

        // Update history with AI reply
        const updatedHistory = [
            ...history,
            { role: 'model' as const, content: parsed.reply }
        ]

        // Safety net: count AI replies — if 3+, force readyToSearch
        const aiReplyCount = updatedHistory.filter(m => m.role === 'model').length
        const shouldSearch = parsed.readyToSearch || aiReplyCount >= 3

        if (shouldSearch) {
            // Transition to searching
            await adminClient
                .from('match_requests')
                .update({
                    status: 'searching',
                    conversation_history: updatedHistory,
                })
                .eq('id', matchRequest.id)

            // Kick off matching in background (don't await — let it run)
            findMatch(matchRequest.id).catch(err => console.error('findMatch error:', err))
        } else {
            // Save updated history
            await adminClient
                .from('match_requests')
                .update({ conversation_history: updatedHistory })
                .eq('id', matchRequest.id)
        }

        return {
            reply: parsed.reply,
            readyToSearch: shouldSearch,
            requestId: matchRequest.id,
        }
    } catch (error) {
        console.error('Chat matchmaker error:', error)
        return {
            reply: "I'm having a moment — try again?",
            readyToSearch: false,
            requestId: matchRequest.id,
        }
    }
}

// ─── 4. findMatch ────────────────────────────────────────────────────────────
// Called after AI gathers enough info. Picks the best candidate.

export async function findMatch(requestId: string): Promise<void> {
    const adminClient = getAdminClient()

    try {
        // Load the request
        const { data: request, error: requestError } = await adminClient
            .from('match_requests')
            .select('*')
            .eq('id', requestId)
            .single()

        if (requestError) {
            console.error('[matchmaker] Error loading request:', requestError)
            throw new Error('Failed to load match request')
        }

        if (!request || request.status !== 'searching') {
            console.log('[matchmaker] Request not in searching state, skipping')
            return
        }

        // Get requester's existing conversation partners (to exclude)
        const { data: myParticipations, error: participationError } = await adminClient
            .from('participants')
            .select('conversation_id')
            .eq('user_id', request.requester_id)

        if (participationError) {
            console.error('[matchmaker] Error fetching participations:', participationError)
            throw new Error('Failed to fetch conversation history')
        }

        const myConvoIds = myParticipations?.map(p => p.conversation_id) || []

        let existingPartnerIds: string[] = []
        if (myConvoIds.length > 0) {
            const { data: partners, error: partnersError } = await adminClient
                .from('participants')
                .select('user_id')
                .in('conversation_id', myConvoIds)
                .neq('user_id', request.requester_id)

            if (partnersError) {
                console.error('[matchmaker] Error fetching partners:', partnersError)
                throw new Error('Failed to fetch existing partners')
            }

            existingPartnerIds = [...new Set(partners?.map(p => p.user_id) || [])]
        }

        // Build exclusion list: existing partners + already declined + self
        const excludeIds = [...new Set([
            request.requester_id,
            ...existingPartnerIds,
            ...(request.declined_user_ids || []),
        ])]

        // Query candidates
        let query = adminClient
            .from('profiles')
            .select('id, first_name, age, gender, bio, interests, looking_for, identity_chips, ai_summary')
            .limit(20)

        if (excludeIds.length > 0) {
            query = query.not('id', 'in', `(${excludeIds.join(',')})`)
        }

        const { data: candidates, error: candidatesError } = await query

        if (candidatesError) {
            console.error('[matchmaker] Error fetching candidates:', candidatesError)
            throw new Error('Failed to fetch candidate profiles')
        }

        if (!candidates || candidates.length === 0) {
            await adminClient
                .from('match_requests')
                .update({ status: 'no_candidates' })
                .eq('id', requestId)
            return
        }

        // Build candidates text for AI
        const candidatesList = candidates.map(c => `
            ID: ${c.id}
            Name: ${c.first_name}
            Age: ${c.age}
            Gender: ${c.gender}
            Bio: "${c.bio || ''}"
            Interests: ${c.interests?.join(', ') || 'None listed'}
            Identity: ${c.identity_chips?.join(', ') || 'None listed'}
            AI Summary: "${c.ai_summary || ''}"
        `).join('\n---\n')

        // Build conversation summary for context
        const conversationText = request.conversation_history
            .map((m: any) => `${m.role === 'user' ? 'User' : 'Kintsu'}: ${m.content}`)
            .join('\n')

        const filledPrompt = MATCH_SYSTEM_PROMPT
            .replace('{CONVERSATION_HISTORY}', conversationText)
            .replace('{CANDIDATES_LIST}', candidatesList)

        const matchSchema = {
            type: "OBJECT",
            properties: {
                matchId: { type: "STRING" },
                matchReason: { type: "STRING" },
                introMessage: { type: "STRING" }
            },
            required: ["matchId", "matchReason", "introMessage"]
        }

        const raw = await callGemini(filledPrompt, [], matchSchema)
        const sanitized = raw.replace(/"(?:[^"\\]|\\.)*"/g, m => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r'))
        const parsed = JSON.parse(sanitized) as MatchAIResponse

        // Verify the matched ID exists in candidates
        const matchedCandidate = candidates.find(c => c.id === parsed.matchId)
        if (!matchedCandidate) {
            console.error('[matchmaker] AI picked invalid candidate:', parsed.matchId)
            throw new Error('AI selected invalid candidate')
        }

        // Update request with match (save intro message for later use)
        const { error: updateError } = await adminClient
            .from('match_requests')
            .update({
                status: 'pending_approval',
                matched_user_id: parsed.matchId,
                match_reason: parsed.matchReason,
                intro_message: parsed.introMessage,
            })
            .eq('id', requestId)

        if (updateError) {
            console.error('[matchmaker] Error updating match request:', updateError)
            throw new Error('Failed to update match request')
        }

        console.log('[matchmaker] Successfully matched with candidate:', parsed.matchId)

    } catch (error) {
        console.error('[matchmaker] findMatch error:', error)

        // Set error state with user-friendly message
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        const { error: updateError } = await adminClient
            .from('match_requests')
            .update({
                status: 'error',
                error_message: 'Failed to find matches. Please try again.'
            })
            .eq('id', requestId)

        if (updateError) {
            console.error('[matchmaker] Failed to set error state:', updateError)
        }
    }
}

// ─── 5. respondToMatch ───────────────────────────────────────────────────────
// Called by the matched user to accept or decline

export async function respondToMatch(
    requestId: string,
    accepted: boolean
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const adminClient = getAdminClient()

    // Load the request
    const { data: request } = await adminClient
        .from('match_requests')
        .select('*')
        .eq('id', requestId)
        .eq('matched_user_id', user.id)
        .eq('status', 'pending_approval')
        .single()

    if (!request) return { success: false, error: 'Match request not found' }

    if (accepted) {
        // Create conversation
        const trioId = process.env.NEXT_PUBLIC_TRIO_USER_ID

        const { data: conversation, error: convError } = await adminClient
            .from('conversations')
            .insert({
                is_active: true,
                timer_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                user_ids_who_messaged: [],
            })
            .select()
            .single()

        if (convError || !conversation) return { success: false, error: 'Failed to create conversation' }

        // Add participants
        await adminClient
            .from('participants')
            .insert([
                { conversation_id: conversation.id, user_id: request.requester_id },
                { conversation_id: conversation.id, user_id: user.id }
            ])

        // Use the intro message that was already generated during matching
        // Fallback to a default if somehow missing
        const introMessage = request.intro_message || "Hey you two! I connected you because I think you'd really hit it off — have fun getting to know each other! 🎉"

        // Post intro message from Kintsu
        if (trioId) {
            const { data: messageData, error: msgError } = await adminClient
                .from('messages')
                .insert({
                    conversation_id: conversation.id,
                    sender_id: trioId,
                    content: introMessage,
                    is_ai_generated: true,
                })
                .select()

            if (msgError) {
                console.error('[matchmaker] Error inserting intro message:', msgError)
            } else {
                console.log('[matchmaker] Intro message sent successfully:', messageData)
            }
        } else {
            console.error('[matchmaker] NEXT_PUBLIC_TRIO_USER_ID not set - cannot send intro message')
        }

        // Update request status
        await adminClient
            .from('match_requests')
            .update({
                status: 'accepted',
                conversation_id: conversation.id,
            })
            .eq('id', requestId)

        return { success: true, conversationId: conversation.id }
    } else {
        // Declined — add to declined list, try again
        const declinedIds = [...(request.declined_user_ids || []), user.id]

        await adminClient
            .from('match_requests')
            .update({
                status: 'searching',
                matched_user_id: null,
                match_reason: null,
                declined_user_ids: declinedIds,
            })
            .eq('id', requestId)

        // Try to find next match
        findMatch(requestId).catch(err => console.error('findMatch retry error:', err))

        return { success: true }
    }
}

// ─── 6. clearMatchRequestError ────────────────────────────────────────────────
// Clears an error state and allows user to retry

export async function clearMatchRequestError(requestId: string): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }

    const adminClient = getAdminClient()

    // Delete the errored request so user can start fresh
    const { error } = await adminClient
        .from('match_requests')
        .delete()
        .eq('id', requestId)
        .eq('requester_id', user.id)
        .eq('status', 'error')

    if (error) {
        console.error('[matchmaker] Error clearing match request:', error)
        return { success: false }
    }

    return { success: true }
}
