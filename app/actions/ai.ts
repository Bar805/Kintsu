'use server'

import { createClient } from '@/utils/supabase/server'

export async function generateTrioResponse(conversationId: string): Promise<boolean> {
    const supabase = await createClient()

    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    // 2. Get Context (THE FIX)
    // We grab the NEWEST 10 messages first (descending), then flip them.
    const { data: messagesDesc } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false }) // Newest first
        .limit(10)

    if (!messagesDesc) return false

    // Javascript Reverse: Turn [Newest ... Oldest] into [Oldest ... Newest]
    const messages = messagesDesc.reverse()

    // 3. Prepare Logic
    // Now this actually grabs the REAL last message
    const lastMessage = messages[messages.length - 1]?.content || ""

    // Create a full script so the AI understands the flow
    const conversationScript = messages.map(m =>
        `${m.is_ai_generated ? 'Trio' : 'User'}: ${m.content}`
    ).join('\n')

    // 4. Call Google Gemini
    try {
        const apiKey = process.env.GOOGLE_API_KEY
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `
                        You are Trio, a smart and witty AI friend.
                        
                        Here is the conversation history:
                        ${conversationScript}
                        
                        Reply to the User's last message ("${lastMessage}") based on the history above. Keep it short.
                        `
                    }]
                }]
            })
        })

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`)
        }

        const data = await response.json()
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ""

        // 5. Save Response
        if (responseText) {
            await supabase.from('messages').insert({
                conversation_id: conversationId,
                sender_id: user.id,
                content: responseText,
                is_ai_generated: true
            })
            return true
        }

    } catch (error) {
        console.error('AI Failed:', error)
        // Backup Logic (Just in case)
        const fallback = "I'm having a little trouble thinking right now, but I'm listening!"
        await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: fallback,
            is_ai_generated: true
        })
        return true
    }

    return false
}