'use client'

import { useState, useTransition } from 'react'
import { Profile } from '@/types/database'
import { updateProfile } from '@/app/actions/profile'
import { User, Loader2, Save, X, ChevronLeft, Sparkles, Camera } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { motion } from 'framer-motion'

interface ProfileFormProps {
    profile: Profile
}

export default function ProfilePage({ profile }: ProfileFormProps) {
    const [isPending, startTransition] = useTransition()

    // Form State
    const [interests, setInterests] = useState<string[]>(profile.interests || ['Tech', 'Movies'])
    const [interestInput, setInterestInput] = useState('')

    // Handlers
    const handleAddInterest = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            const val = interestInput.trim()
            if (val && !interests.includes(val)) {
                setInterests([...interests, val])
                setInterestInput('')
            }
        }
    }

    const removeInterest = (tag: string) => {
        setInterests(interests.filter(i => i !== tag))
    }

    const handleSubmit = async (formData: FormData) => {
        formData.append('interests', JSON.stringify(interests))

        startTransition(async () => {
            const result = await updateProfile(formData)
            if (result.success) {
                toast.success('Profile updated successfully!')
            } else {
                toast.error(result.error || 'Something went wrong.')
            }
        })
    }

    return (
        <div className="h-screen w-full overflow-y-auto bg-gray-50/50">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="max-w-4xl mx-auto p-4 md:p-8 pb-32 space-y-8"
            >
                {/* Navigation */}
                <div className="flex items-center">
                    <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors py-2 px-3 -ml-3 rounded-full hover:bg-white hover:shadow-sm">
                        <ChevronLeft size={18} />
                        <span className="font-medium">Back to Dashboard</span>
                    </Link>
                </div>

                <form action={handleSubmit} className="space-y-8">
                    {/* Hero Section */}
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="relative group cursor-pointer">
                            <div className="p-1 rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-amber-500 shadow-lg shadow-orange-200/50">
                                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center overflow-hidden border-4 border-white relative">
                                    {profile.avatar_url ? (
                                        <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={48} className="text-gray-300" />
                                    )}
                                </div>
                            </div>
                            <div className="absolute bottom-1 right-1 bg-white p-2 rounded-full shadow-md text-gray-500 group-hover:text-primary transition-colors border border-gray-100">
                                <Camera size={16} />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{profile.full_name}</h1>
                            <p className="text-gray-500 font-medium">{profile.email}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* Card A: Identity */}
                        <div className="md:col-span-5 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100/60 flex flex-col gap-6">
                            <div className="flex items-center gap-3 text-gray-900 mb-2">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <User size={20} />
                                </div>
                                <h2 className="text-lg font-bold">Identity</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 ml-1">Full Name</label>
                                    <input
                                        name="fullName"
                                        defaultValue={profile.full_name}
                                        type="text"
                                        required
                                        className="w-full p-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 text-gray-900 font-medium transition-all"
                                        placeholder="Your name"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 ml-1">Age</label>
                                        <input
                                            name="age"
                                            defaultValue={profile.age || ''}
                                            type="number"
                                            min="13"
                                            max="120"
                                            required
                                            className="w-full p-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 text-gray-900 font-medium transition-all"
                                            placeholder="25"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 ml-1">Gender</label>
                                        <select
                                            name="gender"
                                            defaultValue={profile.gender || ''}
                                            className="w-full p-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 text-gray-900 font-medium transition-all outline-none appearance-none cursor-pointer"
                                        >
                                            <option value="" disabled>Select</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Non-binary">NB</option>
                                            <option value="Other">Other</option>
                                            <option value="Prefer not to say">Hidden</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Card B: The Vibe */}
                        <div className="md:col-span-7 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100/60 flex flex-col gap-6">
                            <div className="flex items-center gap-3 text-gray-900 mb-2">
                                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                                    <Sparkles size={20} />
                                </div>
                                <h2 className="text-lg font-bold">The Vibe</h2>
                            </div>

                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 ml-1">About Me</label>
                                    <textarea
                                        name="bio"
                                        defaultValue={profile.bio || ''}
                                        rows={3}
                                        placeholder="What's your story?"
                                        className="w-full p-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 text-gray-900 transition-all resize-none"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 ml-1">Looking For</label>
                                    <textarea
                                        name="lookingFor"
                                        defaultValue={profile.looking_for || ''}
                                        rows={2}
                                        placeholder="Friends, mentors, gym buddies..."
                                        className="w-full p-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 text-gray-900 transition-all resize-none"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 ml-1">Interests</label>
                                    <div className="p-2 bg-gray-50 rounded-2xl focus-within:bg-white focus-within:ring-2 focus-within:ring-amber-500/20 transition-all">
                                        <div className="flex flex-wrap gap-2 mb-2 p-2">
                                            {interests.map(tag => (
                                                <span key={tag}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-sm font-semibold transition-transform hover:scale-105 cursor-default">
                                                    {tag}
                                                    <button type="button" onClick={() => removeInterest(tag)} className="hover:text-amber-950 transition-colors rounded-full p-0.5 hover:bg-amber-200/50">
                                                        <X size={12} />
                                                    </button>
                                                </span>
                                            ))}
                                            <input
                                                value={interestInput}
                                                onChange={(e) => setInterestInput(e.target.value)}
                                                onKeyDown={handleAddInterest}
                                                placeholder={interests.length === 0 ? "Add interests (e.g. Hiking)..." : ""}
                                                className="bg-transparent outline-none flex-1 text-sm min-w-[120px] p-1.5 placeholder:text-gray-400"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Floating Action / Submit */}
                    <div className="fixed bottom-6 right-6 md:static md:flex md:justify-end md:bottom-auto md:right-auto pointer-events-none md:pointer-events-auto z-50">
                        <div className="pointer-events-auto shadow-2xl md:shadow-none rounded-full md:rounded-none">
                            <button
                                type="submit"
                                disabled={isPending}
                                className="flex items-center gap-2 bg-gray-900 text-white px-8 py-4 rounded-full font-semibold hover:bg-black disabled:opacity-70 transition-all shadow-lg hover:shadow-xl active:scale-95"
                            >
                                {isPending ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                {isPending ? 'Saving...' : 'Save Profile'}
                            </button>
                        </div>
                    </div>
                </form>
            </motion.div>
        </div>
    )
}
