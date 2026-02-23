'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { TRIO_CONFIG } from '@/lib/trio-config'

export interface UserProfile {
    id: string
    first_name: string
    interests: string[]
    bio: string
}

export async function evaluateConversationState(conversationId: string, profiles: UserProfile[]): Promise<boolean> {
    const supabase = await createClient()

    // 1. Get History (Last 3 messages)
    const { data: messagesDesc } = await supabase
        .from('messages')
        .select('content, sender_id, is_ai_generated')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(3)

    if (!messagesDesc || messagesDesc.length === 0) return false
    const messages = messagesDesc.reverse()

    // SAFETY: If last message was AI, don't speak
    if (messages[messages.length - 1].is_ai_generated) return false

    // 2. Call Judge AI
    try {
        const apiKey = process.env.GOOGLE_API_KEY
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

        const prompt = `
        ${TRIO_CONFIG.SCORING_RUBRIC}

        CONTEXT (Profiles):
        ${profiles.map(p => `- ${p.first_name}: ${(p.interests || []).join(', ')}`).join('\n')}

        CHAT HISTORY:
        ${messages.map(m => `${m.is_ai_generated ? 'Trio' : 'User'}: ${m.content}`).join('\n')}

        Return ONLY a JSON object: { "score": number, "reason": "string" }
        `

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        })

        if (!response.ok) return false

        const textRaw = await response.text()
        let data
        try {
            data = JSON.parse(textRaw)
        } catch (e) {
            console.error("[ai] Valid JSON check failed. Raw response:", textRaw)
            return false
        }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
        const result = JSON.parse(text)

        console.log("Trio Judge Result:", result)

        return result.score >= TRIO_CONFIG.INTERJECTION_THRESHOLD

    } catch (e) {
        console.error("Evaluation failed", e)
        return false
    }
}



export async function generateTrioResponse(conversationId: string, profiles?: UserProfile[]): Promise<boolean> {
    const supabase = await createClient()

    let activeProfiles = profiles

    // If profiles not provided (e.g. called from UI), fetch them
    if (!activeProfiles) {
        const { data: participants } = await supabase
            .from('participants')
            .select('user_id')
            .eq('conversation_id', conversationId)

        if (participants) {
            const userIds = participants.map(p => p.user_id)
            const { data: rawProfiles } = await supabase
                .from('profiles')
                .select('id, first_name, interests, bio')
                .in('id', userIds)

            if (rawProfiles) {
                activeProfiles = rawProfiles.map(p => ({
                    id: p.id,
                    first_name: p.first_name || 'Unknown',
                    interests: Array.isArray(p.interests) ? p.interests.map(String) : [],
                    bio: p.bio || ''
                }))
            }
        }
    }

    if (!activeProfiles || activeProfiles.length === 0) return false

    // 1. Get Full History
    const { data: messagesDesc } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(10)

    if (!messagesDesc) return false
    const messages = messagesDesc.reverse()
    const lastMessage = messages[messages.length - 1]?.content || ""

    // 2. Prepare Context
    const profileContext = activeProfiles.map(p => `
    [User: ${p.first_name}]
    - Bio: "${p.bio}"
    - Interests: ${(p.interests || []).join(', ')}
    `).join('\n')

    const conversationScript = messages.map(m =>
        `${m.is_ai_generated ? 'Trio' : 'User'}: ${m.content}`
    ).join('\n')

    // 3. Call AI
    try {
        const apiKey = process.env.GOOGLE_API_KEY
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `
                        ${TRIO_CONFIG.SYSTEM_PROMPT}

                        USER PROFILES:
                        ${profileContext}

                        CHAT HISTORY:
                        ${conversationScript}
                        
                        Respond to the conversation as Trio.
                        `
                    }]
                }]
            })
        })

        if (!response.ok) throw new Error(`API Error: ${response.status}`)

        const textRaw = await response.text()
        let data
        try {
            data = JSON.parse(textRaw)
        } catch (e) {
            console.error('[ai] Valid JSON check failed. Raw response:', textRaw)
            throw new Error(`API Error: Invalid JSON`)
        }
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ""

        // 4. Save Response using ADMIN CLIENT (Bypass RLS)
        const trioId = process.env.NEXT_PUBLIC_TRIO_USER_ID
        if (!trioId) throw new Error("Missing Trio ID")

        if (responseText) {
            const adminSupabase = createAdminClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                { auth: { autoRefreshToken: false, persistSession: false } }
            )

            await adminSupabase.from('messages').insert({
                conversation_id: conversationId,
                sender_id: trioId,
                content: responseText,
                is_ai_generated: true
            })
            return true
        }

    } catch (error) {
        console.error('AI Failed:', error)
        return false
    }

    return false
}