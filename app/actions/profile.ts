'use server'

import { createClient } from '@/utils/supabase/server'
import { Profile } from '@/types/database'
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

export async function updateProfile(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    const fullName = formData.get('fullName') as string
    const ageRaw = formData.get('age') as string
    const gender = formData.get('gender') as string
    const bio = formData.get('bio') as string
    const lookingFor = formData.get('lookingFor') as string
    const interestsJson = formData.get('interests') as string

    // Validation
    const age = parseInt(ageRaw)
    if (isNaN(age) || age < 18) {
        // Just a simple check, maybe they allow <18 but usually social apps don't or strict on it
        // User asked to "Validate inputs (e.g., age must be realistic)"
        // Let's say realistic is 13+ or 18+, I'll go with 13 for generic, or just > 0. 
        // Let's stick to a sane default like 13.
        if (age < 13 || age > 120) {
            return { success: false, error: 'Please enter a valid age.' }
        }
    }

    let interests: string[] = []
    try {
        interests = JSON.parse(interestsJson || '[]')
    } catch (e) {
        return { success: false, error: 'Invalid interests format' }
    }

    const updates: Partial<Profile> = {
        full_name: fullName,
        age: age,
        gender: gender,
        bio: bio,
        looking_for: lookingFor,
        interests: interests,
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
