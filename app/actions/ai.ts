'use server'

import { createClient } from '@/utils/supabase/server'

export async function generateTrioResponse(conversationId: string): Promise<boolean> {
    const supabase = await createClient()

    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    // 2. Get History (Short Term Memory)
    const { data: messagesDesc } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(10)

    if (!messagesDesc) return false
    const messages = messagesDesc.reverse()
    const lastMessage = messages[messages.length - 1]?.content || ""

    // 3. Get YOUR Profile (Self Awareness)
    const { data: myProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    const myContext = myProfile ? `
        MY PROFILE (The User):
        - Name: ${myProfile.full_name}
        - Age: ${myProfile.age}
        - Bio: "${myProfile.bio}"
        - Interests: ${myProfile.interests?.join(', ')}
        - Looking For: "${myProfile.looking_for}"
    ` : "User Profile: Unknown."

    // 4. (NEW) Get CANDIDATES (The Dating Pool)
    // We fetch everyone EXCEPT the current user
    const { data: candidates } = await supabase
        .from('profiles')
        .select('full_name, age, gender, bio, interests, looking_for')
        .neq('id', user.id) // Exclude myself
        .limit(10) // Limit to 10 for now to save AI tokens

    // Format candidates for the AI to read
    const candidateList = candidates?.map(c =>
        `- ${c.full_name} (${c.age}, ${c.gender}): Likes ${c.interests?.join(', ')}. Bio: "${c.bio}"`
    ).join('\n') || "No other users found."

    const conversationScript = messages.map(m =>
        `${m.is_ai_generated ? 'Trio' : 'User'}: ${m.content}`
    ).join('\n')

    // 5. Call Google Gemini
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
                        You are Trio, a smart, witty AI wingman.
                        
                        ${myContext}

                        AVAILABLE SINGLES IN THE AREA (Database):
                        ${candidateList}

                        INSTRUCTIONS:
                        1. If the user asks for a match or date, recommend 1-2 people from the "Available Singles" list above.
                        2. EXPLAIN WHY they match based on the User's profile (e.g. "Since you like Chess, you should meet Mike...").
                        3. If not asked for a match, just chat normally and be witty.
                        4. Keep it short (2-3 sentences max).

                        History:
                        ${conversationScript}
                        
                        Reply to: "${lastMessage}"
                        `
                    }]
                }]
            })
        })

        if (!response.ok) throw new Error(`API Error: ${response.status}`)

        const data = await response.json()
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ""

        // 6. Save Response
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
        // Backup
        await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: "I'm having trouble scanning the room right now. Ask me again in a sec!",
            is_ai_generated: true
        })
        return true
    }

    return false
}