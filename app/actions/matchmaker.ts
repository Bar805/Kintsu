'use server'

import { createClient } from '@/utils/supabase/server'
import { Message } from '@/types/database'

const SYSTEM_PROMPT = `
You are Trio, a close mutual friend of the user. You are helping them find a match.

Goal:
Chat with the user to understand what they are looking for.
If you have enough information, cross-reference with the list of "AVAILABLE CANDIDATES".
If you find a high-confidence match (and ONLY if you are very sure), stop asking questions and DECLARE A MATCH.

Tone:
- Casual, friendly, like a supportive friend.
- Don't sound like a robot.
- Be concise (max 2-3 sentences).

Candidates:
{CANDIDATES_LIST}

My Profile:
{MY_PROFILE}

Output Format:
Return a JSON object ONLY. No markdown, no other text.
{
  "matchFound": boolean, // true if you found a specific match to introduce
  "matchId": string | null, // The UUID of the match from the list (if matchFound is true)
  "reply": "...", // If matchFound is false, this is your question/reply. If matchFound is true, this is a very short "hyping up" confirmation (e.g. "I know exactly who you should meet!").
  "introMessage": "..." // ONLY if matchFound is true. This is the message you will post in the new chat. Introduce them! (e.g. "Hey [User] and [Match], I connected you because...")
}
`

export type MatchmakerResponse = {
    matchFound: boolean
    matchId?: string
    reply: string
    introMessage?: string
}

export async function askMatchmaker(history: { role: 'user' | 'model', content: string }[]): Promise<MatchmakerResponse> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Unauthorized')
    }

    // 1. Get My Profile
    const { data: myProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    const myProfileText = myProfile ? `
        Name: ${myProfile.full_name}
        Age: ${myProfile.age}
        Gender: ${myProfile.gender}
        Bio: "${myProfile.bio}"
        Interests: ${myProfile.interests?.join(', ')}
        Looking For: "${myProfile.looking_for}"
    ` : "Unknown"

    // 2. Exclude users we already have conversations with
    const { data: myParticipations } = await supabase
        .from('participants')
        .select('conversation_id')
        .eq('user_id', user.id)

    const myConvoIds = myParticipations?.map(p => p.conversation_id) || []

    let existingPartnerIds: string[] = []
    if (myConvoIds.length > 0) {
        const { data: partners } = await supabase
            .from('participants')
            .select('user_id')
            .in('conversation_id', myConvoIds)
            .neq('user_id', user.id)

        existingPartnerIds = [...new Set(partners?.map(p => p.user_id) || [])]
    }

    // 3. Get Candidates (exclude self + existing connections)
    let query = supabase
        .from('profiles')
        .select('id, full_name, age, gender, bio, interests, looking_for')
        .neq('id', user.id)
        .limit(20)

    if (existingPartnerIds.length > 0) {
        // Filter out users we're already connected with
        query = query.not('id', 'in', `(${existingPartnerIds.join(',')})`)
    }

    const { data: candidates } = await query

    const candidatesList = candidates?.map(c => `
        ID: ${c.id}
        Name: ${c.full_name}
        Age: ${c.age}
        Gender: ${c.gender}
        Bio: "${c.bio}"
        Interests: ${c.interests?.join(', ')}
        Looking For: "${c.looking_for}"
    `).join('\n---\n') || "No candidates found."

    // 3. Construct Prompt
    const filledPrompt = SYSTEM_PROMPT
        .replace('{CANDIDATES_LIST}', candidatesList)
        .replace('{MY_PROFILE}', myProfileText)

    // 4. Call Gemini
    try {
        const apiKey = process.env.GOOGLE_API_KEY
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`

        const contents = [
            {
                role: 'user',
                parts: [{ text: filledPrompt }]
            },
            ...history.map(m => ({
                role: m.role,
                parts: [{ text: m.content }]
            }))
        ]

        // If the last message was from the model, we can't send it as the last part if we want to follow 'user' turn usually, 
        // but Gemini supports multi-turn history.
        // However, we are sending the system prompt as the first USER message to set context.
        // For accurate chat, we usually append the history.

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                generationConfig: {
                    responseMimeType: "application/json"
                }
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

        const parsed = JSON.parse(text) as MatchmakerResponse
        return parsed

    } catch (error) {
        console.error('Matchmaker Error:', error)
        // Fallback
        return {
            matchFound: false,
            reply: "I'm having a bit of trouble checking my list. Give me a second and ask again?",
        }
    }
}
