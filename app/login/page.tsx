'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const router = useRouter()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setMessage(error.message)
            setLoading(false)
        } else {
            router.push('/dashboard')
            router.refresh()
        }
    }

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${location.origin}/auth/callback`,
            },
        })

        if (error) {
            setMessage(error.message)
        } else {
            setMessage('Check email to continue sign in process')
        }
        setLoading(false)
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-24">
            <h1 className="text-2xl font-bold mb-8">Login to Trio</h1>

            <form className="flex flex-col gap-4 w-full max-w-md">
                <input
                    className="p-2 border rounded text-black"
                    name="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    className="p-2 border rounded text-black"
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <div className="flex gap-2">
                    <button
                        className="flex-1 bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                        onClick={handleLogin}
                        disabled={loading}
                    >
                        {loading ? 'Loading...' : 'Sign In'}
                    </button>
                    <button
                        className="flex-1 bg-green-500 text-white p-2 rounded hover:bg-green-600"
                        onClick={handleSignUp}
                        disabled={loading}
                    >
                        Sign Up
                    </button>
                </div>

                {message && (
                    <p className="mt-4 p-4 bg-gray-100 text-center text-black rounded">
                        {message}
                    </p>
                )}
            </form>
        </div>
    )
}
