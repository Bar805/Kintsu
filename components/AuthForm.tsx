'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AuthForm() {
    const [isSignUp, setIsSignUp] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        if (isSignUp) {
            if (password !== confirmPassword) {
                toast.error("Passwords do not match")
                setLoading(false)
                return
            }
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: `${location.origin}/auth/callback` },
            })
            if (error) {
                toast.error(error.message)
            } else {
                toast.success('Check your email to confirm sign up!')
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if (error) {
                toast.error(error.message)
            } else {
                router.push('/dashboard')
                router.refresh()
            }
        }
        setLoading(false)
    }

    return (
        <motion.div layout className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-sand">
            <div className="p-8">
                {/* Kintsu Logo */}
                <div className="flex flex-col items-center mb-8">
                    <div className="flex items-center gap-1 mb-3">
                        <div className="w-6 h-6 rounded-full bg-rust"></div>
                        <div className="w-6 h-6 bg-teal"></div>
                    </div>
                    <h1 className="text-3xl font-bold text-charcoal tracking-tight">
                        kintsu
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Your social catalyst</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-charcoal mb-2">Email</label>
                        <input
                            className="w-full p-3 bg-cream border border-sand rounded-2xl focus:ring-2 focus:ring-rust/20 focus:border-rust outline-none transition-all text-sm font-medium placeholder-gray-400"
                            placeholder="you@example.com"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-charcoal mb-2">Password</label>
                        <input
                            className="w-full p-3 bg-cream border border-sand rounded-2xl focus:ring-2 focus:ring-rust/20 focus:border-rust outline-none transition-all text-sm font-medium placeholder-gray-400"
                            placeholder="••••••••"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <AnimatePresence>
                        {isSignUp && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="pt-0">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-charcoal mb-2">Confirm Password</label>
                                    <input
                                        className="w-full p-3 bg-cream border border-sand rounded-2xl focus:ring-2 focus:ring-rust/20 focus:border-rust outline-none transition-all text-sm font-medium placeholder-gray-400"
                                        placeholder="••••••••"
                                        type="password"
                                        required={isSignUp}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-charcoal text-white font-bold py-3.5 rounded-full shadow-lg hover:bg-rust transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
                        {!loading && <Sparkles size={18} className="text-mustard" />}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-sm text-gray-500 hover:text-rust transition-colors font-medium"
                    >
                        {isSignUp
                            ? "Already have an account? Sign In"
                            : "Don't have an account? Sign Up"}
                    </button>
                </div>
            </div>
        </motion.div>
    )
}
