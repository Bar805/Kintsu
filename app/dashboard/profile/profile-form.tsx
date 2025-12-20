'use client'

import { useState, useTransition } from 'react'
import { Profile } from '@/types/database'
import { updateProfile } from '@/app/actions/profile'
import { User, Loader2, Save, X } from 'lucide-react'

interface ProfileFormProps {
    profile: Profile
}

export default function ProfilePage({ profile }: ProfileFormProps) {
    const [isPending, startTransition] = useTransition()
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    // Form State
    const [interests, setInterests] = useState<string[]>(profile.interests || ['Tech', 'Movies']) // Default mock if empty
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
        setMessage(null)
        // Append JSON interests
        formData.append('interests', JSON.stringify(interests))

        startTransition(async () => {
            const result = await updateProfile(formData)
            if (result.success) {
                setMessage({ type: 'success', text: 'Profile updated successfully!' })
            } else {
                setMessage({ type: 'error', text: result.error || 'Something went wrong.' })
            }
        })
    }

    return (
        <div className="h-screen w-full overflow-y-auto bg-gray-50">
            <div className="max-w-3xl mx-auto p-6 space-y-8 pb-24">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Your Profile</h1>
                    <p className="text-gray-500 mt-2">Manage your personal information and how others see you on Trio.</p>
                </header>

                <form action={handleSubmit} className="space-y-8 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">

                    {/* Avatar Section */}
                    <div className="flex items-center gap-6 pb-8 border-b border-gray-100">
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 overflow-hidden border-4 border-white shadow-md">
                            {profile.avatar_url ? (
                                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <User size={40} />
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">{profile.full_name}</h2>
                            <p className="text-sm text-gray-500">{profile.email}</p>
                            {/* Placeholder for upload */}
                            <button type="button" disabled className="mt-3 text-xs font-medium text-primary hover:text-blue-700 disabled:opacity-50">
                                Change Photo (Coming Soon)
                            </button>
                        </div>
                    </div>

                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Full Name</label>
                            <input
                                name="fullName"
                                defaultValue={profile.full_name}
                                type="text"
                                required
                                className="w-full p-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-gray-200 focus:ring-2 focus:ring-primary/10 transition-all outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Age</label>
                                <input
                                    name="age"
                                    defaultValue={profile.age || ''}
                                    type="number"
                                    min="13"
                                    max="120"
                                    required
                                    className="w-full p-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-gray-200 focus:ring-2 focus:ring-primary/10 transition-all outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Gender</label>
                                <select
                                    name="gender"
                                    defaultValue={profile.gender || ''}
                                    className="w-full p-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-gray-200 focus:ring-2 focus:ring-primary/10 transition-all outline-none"
                                >
                                    <option value="" disabled>Select</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Non-binary">Non-binary</option>
                                    <option value="Other">Other</option>
                                    <option value="Prefer not to say">Prefer not to say</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Bio */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Bio</label>
                        <textarea
                            name="bio"
                            defaultValue={profile.bio || ''}
                            rows={4}
                            placeholder="Tell us a bit about yourself..."
                            className="w-full p-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-gray-200 focus:ring-2 focus:ring-primary/10 transition-all outline-none resize-none"
                        />
                    </div>

                    {/* Interests (Tag Input) */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700">Interests</label>
                        <div className="p-3 bg-gray-50 border border-transparent rounded-xl focus-within:bg-white focus-within:border-gray-200 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                            <div className="flex flex-wrap gap-2 mb-2">
                                {interests.map(tag => (
                                    <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                                        {tag}
                                        <button type="button" onClick={() => removeInterest(tag)} className="hover:text-blue-900"><X size={14} /></button>
                                    </span>
                                ))}
                            </div>
                            <input
                                value={interestInput}
                                onChange={(e) => setInterestInput(e.target.value)}
                                onKeyDown={handleAddInterest}
                                placeholder="Type an interest and press Enter (e.g. Hiking)"
                                className="bg-transparent outline-none w-full text-sm"
                            />
                        </div>
                    </div>

                    {/* Looking For */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Looking For</label>
                        <textarea
                            name="lookingFor"
                            defaultValue={profile.looking_for || ''}
                            rows={3}
                            placeholder="What kind of connections are you hoping to make?"
                            className="w-full p-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-gray-200 focus:ring-2 focus:ring-primary/10 transition-all outline-none resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex items-center justify-between border-t border-gray-100">
                        <div className="text-sm">
                            {message && (
                                <span className={message.type === 'success' ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                                    {message.text}
                                </span>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-800 disabled:opacity-70 transition-all shadow-sm hover:shadow-md active:scale-95"
                        >
                            {isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
