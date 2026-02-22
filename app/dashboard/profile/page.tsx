
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getProfile } from '@/app/actions/profile'
import ProfileForm from './profile-form'

export default async function ProfilePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const profile = await getProfile(user.id)

    if (!profile) {
        // Handle edge case where profile trigger failed or doesn't exist
        return <div>Profile not found. Please contact support.</div>
    }

    const isProfileComplete = Boolean(
        profile.first_name &&
        profile.age &&
        profile.gender &&
        profile.identity_chips &&
        profile.identity_chips.length > 0
    )

    return <ProfileForm profile={profile} requireSetup={!isProfileComplete} />
}
