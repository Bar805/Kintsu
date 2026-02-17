import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AuthForm from '@/components/AuthForm'

export default async function Home() {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
        redirect('/dashboard')
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-cream">
            <AuthForm />
        </main>
    )
}
