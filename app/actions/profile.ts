'use server'

import { createClient } from '@/utils/supabase/server'
import { Profile, VibeSliders, PromptAnswer } from '@/types/database'
import { revalidatePath } from 'next/cache'

export async function getProfile(userId: string): Promise<Profile | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

    if (error) {
        console.error('Error fetching profile:', error)
        return null
    }

    return data
}

export async function updateProfile(payload: {
    fullName: string
    age: number
    gender: string
    sliders: VibeSliders
    identityChips: string[]
    promptAnswer: PromptAnswer | null
    aiSummary: string
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Validation
    if (!payload.fullName.trim()) {
        return { success: false, error: 'Name is required.' }
    }

    if (payload.age < 13 || payload.age > 120 || isNaN(payload.age)) {
        return { success: false, error: 'Please enter a valid age.' }
    }

    if (payload.identityChips.length > 5) {
        return { success: false, error: 'Maximum 5 identity chips allowed.' }
    }

    const updates = {
        full_name: payload.fullName.trim(),
        age: payload.age,
        gender: payload.gender,
        sliders: payload.sliders,
        identity_chips: payload.identityChips,
        prompt_answer: payload.promptAnswer,
        ai_summary: payload.aiSummary,
    }

    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

    if (error) {
        console.error('Error updating profile:', error)
        return { success: false, error: 'Failed to update profile' }
    }

    revalidatePath('/dashboard/profile')
    return { success: true }
}

export async function updateAvatar(avatarUrl: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)

    if (error) {
        console.error('Error updating avatar:', error)
        return { success: false, error: 'Failed to update avatar' }
    }

    revalidatePath('/dashboard/profile')
    return { success: true }
}

// ============================================================
// AI Bio Generation
// ============================================================
export async function generateIdentitySummary(
    sliders: VibeSliders,
    chips: string[],
    promptAnswer: PromptAnswer
): Promise<{ summary: string | null; error?: string }> {
    try {
        const apiKey = process.env.GOOGLE_API_KEY
        if (!apiKey) {
            return { summary: null, error: 'API key not configured' }
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`

        const prompt = `
You are writing a short, punchy, third-person bio for a social app profile.
It should feel like a witty "About Me" blurb — 2-3 sentences max. Be fun, warm, and specific.

DATA ABOUT THIS PERSON:
- Social Battery: ${sliders.social_battery}/100 (0=total introvert, 100=life of the party)
- Planning Style: ${sliders.planning}/100 (0=spontaneous, 100=itinerary for everything)
- Conversation: ${sliders.conversation}/100 (0=listener, 100=storyteller)
- Thinking: ${sliders.thinking}/100 (0=gut feeling, 100=pure logic)
- Risk Tolerance: ${sliders.risk}/100 (0=comfort zone, 100=send it)

- They identify as: ${chips.join(', ')}

- When asked "${promptAnswer.prompt}", they said:
  "${promptAnswer.answer}"

Write ONE engaging bio (no quotes, no labels, no bullet points). Just the bio text.
`

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
            }),
        })

        if (!response.ok) {
            console.error('Gemini API error:', response.status)
            return { summary: null, error: 'AI generation failed' }
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null

        return { summary: text }
    } catch (error) {
        console.error('AI generation error:', error)
        return { summary: null, error: 'Failed to generate bio' }
    }
}
