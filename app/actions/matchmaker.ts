'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────────────

export type MatchRequest = {
    id: string
    requester_id: string
    status: 'chatting' | 'searching' | 'pending_approval' | 'accepted' | 'declined' | 'expired' | 'no_candidates'
    matched_user_id: string | null
    declined_user_ids: string[]
    conversation_history: { role: 'user' | 'model'; content: string }[]
    match_reason: string | null
    conversation_id: string | null
    created_at: string
    updated_at: string
    expires_at: string
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

Output JSON only, no markdown:
{
  "reply": "your conversational message",
  "readyToSearch": false
}
`

const MATCH_SYSTEM_PROMPT = `
You are Kintsu, matching people based on compatibility.

The user described what they're looking for in this conversation:
{CONVERSATION_HISTORY}

Here are the available candidates:
{CANDIDATES_LIST}

Pick the BEST single match. Consider personality compatibility, shared interests, and what the requester explicitly asked for.

Write a matchReason shown on a card to the matched person. Use exactly 3 SHORT bullet points (max 8 words each). Be punchy and specific, not generic. Example: "• Both obsessed with sourdough\n• You're the climbing partner they need\n• Shared love of late-night philosophy"

Also write an intro_message that Kintsu would post in the group chat once both people accept. It should introduce them to each other and mention what they have in common. Be casual and fun.

Output JSON only, no markdown:
{
  "matchId": "the UUID of the best candidate",
  "matchReason": "• Bullet 1\\n• Bullet 2\\n• Bullet 3",
  "introMessage": "Hey [Name1] and [Name2], I connected you because..."
}
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

async function callGemini(systemPrompt: string, history: { role: string; content: string }[]): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

    const contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        ...history.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
        }))
    ]

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: { responseMimeType: 'application/json' }
        })
    })

    if (!response.ok) {
        const err = await response.text()
        console.error('Gemini API Error:', err)
        throw new Error(`API Error: ${response.status}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('No response from AI')
    return text
}

// ─── 1. getActiveMatchRequest ────────────────────────────────────────────────
// Returns the user's current active match request (if any)

export async function getActiveMatchRequest(): Promise<MatchRequest | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Check for expired requests first and expire them
    const adminClient = getAdminClient()
    await adminClient
        .from('match_requests')
        .update({ status: 'expired' })
        .eq('requester_id', user.id)
        .in('status', ['chatting', 'searching', 'pending_approval'])
        .lt('expires_at', new Date().toISOString())

    const { data } = await supabase
        .from('match_requests')
        .select('*')
        .eq('requester_id', user.id)
        .in('status', ['chatting', 'searching', 'pending_approval'])
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
        .select('id, full_name, age, gender, avatar_url, bio, interests, identity_chips, ai_summary')
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
        const raw = await callGemini(CHAT_SYSTEM_PROMPT, history)
        const parsed = JSON.parse(raw) as ChatAIResponse

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

    // Load the request
    const { data: request } = await adminClient
        .from('match_requests')
        .select('*')
        .eq('id', requestId)
        .single()

    if (!request || request.status !== 'searching') return

    // Get requester's existing conversation partners (to exclude)
    const { data: myParticipations } = await adminClient
        .from('participants')
        .select('conversation_id')
        .eq('user_id', request.requester_id)

    const myConvoIds = myParticipations?.map(p => p.conversation_id) || []

    let existingPartnerIds: string[] = []
    if (myConvoIds.length > 0) {
        const { data: partners } = await adminClient
            .from('participants')
            .select('user_id')
            .in('conversation_id', myConvoIds)
            .neq('user_id', request.requester_id)

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
        .select('id, full_name, age, gender, bio, interests, looking_for, identity_chips, ai_summary')
        .limit(20)

    if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`)
    }

    const { data: candidates } = await query

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
        Name: ${c.full_name}
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

    try {
        const raw = await callGemini(filledPrompt, [])
        const parsed = JSON.parse(raw) as MatchAIResponse

        // Verify the matched ID exists in candidates
        const matchedCandidate = candidates.find(c => c.id === parsed.matchId)
        if (!matchedCandidate) {
            console.error('AI picked invalid candidate:', parsed.matchId)
            await adminClient
                .from('match_requests')
                .update({ status: 'no_candidates' })
                .eq('id', requestId)
            return
        }

        // Update request with match
        await adminClient
            .from('match_requests')
            .update({
                status: 'pending_approval',
                matched_user_id: parsed.matchId,
                match_reason: parsed.matchReason,
            })
            .eq('id', requestId)

    } catch (error) {
        console.error('findMatch AI error:', error)
        await adminClient
            .from('match_requests')
            .update({ status: 'no_candidates' })
            .eq('id', requestId)
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
            .insert({ is_active: true })
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

        // Build intro message from conversation context
        const conversationText = request.conversation_history
            .map((m: any) => `${m.role === 'user' ? 'User' : 'Kintsu'}: ${m.content}`)
            .join('\n')

        // Generate intro message
        let introMessage = "Hey! Kintsu connected you two — have fun getting to know each other! 🎉"
        try {
            const introPrompt = `You are Kintsu. You just matched two people. Write a brief, fun intro message for their chat. Mention what they have in common based on this conversation: ${conversationText}. Output just the message text, no JSON.`
            const raw = await callGemini(introPrompt, [{ role: 'user', content: 'Generate the intro' }])
            introMessage = raw.replace(/^["']|["']$/g, '').trim()
        } catch (e) {
            console.error('Intro generation error:', e)
        }

        // Post intro message from Kintsu
        if (trioId) {
            await adminClient
                .from('messages')
                .insert({
                    conversation_id: conversation.id,
                    sender_id: trioId,
                    content: introMessage,
                    is_ai_generated: true,
                })
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
