
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

    return <ProfileForm profile={profile} />
}
