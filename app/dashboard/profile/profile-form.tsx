'use client'

import { useState, useTransition, useRef } from 'react'
import { Profile, VibeSliders as VibeSliderValues, PromptAnswer } from '@/types/database'
import { updateProfile, updateAvatar } from '@/app/actions/profile'
import { createClient } from '@/utils/supabase/client'
import { User, Loader2, Save, ChevronLeft, ChevronRight, Sparkles, Camera, Zap, Tags, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import VibeSliders from '@/components/VibeSliders'
import IdentityChipCloud from '@/components/IdentityChipCloud'
import PromptRoulette from '@/components/PromptRoulette'

interface ProfileFormProps {
    profile: Profile
}

const DEFAULT_SLIDERS: VibeSliderValues = {
    social_battery: 50,
    planning: 50,
    conversation: 50,
    thinking: 50,
    risk: 50,
}

const STEPS = [
    { key: 'basics', label: 'You', icon: User, color: 'blue' },
    { key: 'vibe', label: 'Vibe', icon: Zap, color: 'amber' },
    { key: 'identity', label: 'Identity', icon: Tags, color: 'violet' },
    { key: 'story', label: 'Story', icon: MessageCircle, color: 'rose' },
]

export default function ProfilePage({ profile }: ProfileFormProps) {
    const [isPending, startTransition] = useTransition()
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [currentStep, setCurrentStep] = useState(0)

    // Form State
    const [fullName, setFullName] = useState(profile.full_name || '')
    const [age, setAge] = useState(profile.age?.toString() || '')
    const [gender, setGender] = useState(profile.gender || '')

    const [sliders, setSliders] = useState<VibeSliderValues>(
        profile.sliders || DEFAULT_SLIDERS
    )
    const [identityChips, setIdentityChips] = useState<string[]>(
        profile.identity_chips || []
    )
    const [promptAnswer, setPromptAnswer] = useState<PromptAnswer | null>(
        profile.prompt_answer || null
    )
    const [aiSummary, setAiSummary] = useState(profile.ai_summary || '')

    // Navigation
    const canGoNext = () => {
        switch (currentStep) {
            case 0:
                return fullName.trim() && age && gender
            case 1:
                return true // sliders always have defaults
            case 2:
                return identityChips.length > 0
            case 3:
                return true
            default:
                return false
        }
    }

    const goNext = () => {
        if (currentStep < STEPS.length - 1 && canGoNext()) {
            setCurrentStep(currentStep + 1)
        }
    }

    const goBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }

    // Avatar Upload
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File too large. Max size is 5MB.')
            return
        }

        setIsUploading(true)
        try {
            const supabase = createClient()
            const fileExt = file.name.split('.').pop()
            const fileName = `${profile.id}/${Date.now()}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName)

            const result = await updateAvatar(publicUrl)
            if (result.success) {
                toast.success('Photo updated!')
                window.location.reload()
            } else {
                toast.error(result.error || 'Failed to save avatar.')
            }
        } catch (error: any) {
            console.error(error)
            toast.error('Upload failed. Try again.')
        } finally {
            setIsUploading(false)
        }
    }

    // Save All
    const handleSave = () => {
        startTransition(async () => {
            const result = await updateProfile({
                fullName: fullName.trim(),
                age: parseInt(age),
                gender,
                sliders,
                identityChips,
                promptAnswer,
                aiSummary,
            })
            if (result.success) {
                toast.success('Profile saved! 🎉')
            } else {
                toast.error(result.error || 'Something went wrong.')
            }
        })
    }

    // Step transition variants
    const stepVariants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 80 : -80,
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (direction: number) => ({
            x: direction > 0 ? -80 : 80,
            opacity: 0,
        }),
    }

    const [direction, setDirection] = useState(0)

    const navigateStep = (newStep: number) => {
        setDirection(newStep > currentStep ? 1 : -1)
        setCurrentStep(newStep)
    }

    const handleNext = () => {
        if (canGoNext()) {
            setDirection(1)
            setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1))
        }
    }

    const handleBack = () => {
        setDirection(-1)
        setCurrentStep(prev => Math.max(prev - 1, 0))
    }

    return (
        <div className="h-screen w-full overflow-y-auto bg-gray-50/50">
            <div className="max-w-2xl mx-auto px-4 py-6 pb-32 min-h-full flex flex-col">

                {/* Top Bar */}
                <div className="flex items-center justify-between mb-6">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-700 transition-colors text-sm font-medium"
                    >
                        <ChevronLeft size={16} />
                        Back
                    </Link>

                    {/* Avatar */}
                    <div
                        className="relative cursor-pointer group"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="p-0.5 rounded-full bg-gradient-to-br from-amber-300 to-orange-500">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center overflow-hidden">
                                {isUploading ? (
                                    <Loader2 size={16} className="animate-spin text-amber-500" />
                                ) : profile.avatar_url ? (
                                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={16} className="text-gray-300" />
                                )}
                            </div>
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 bg-white p-1 rounded-full shadow-sm text-gray-400 group-hover:text-amber-500 transition-colors">
                            <Camera size={10} />
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageUpload}
                        />
                    </div>
                </div>

                {/* Step Progress */}
                <div className="flex items-center gap-2 mb-8">
                    {STEPS.map((step, index) => {
                        const StepIcon = step.icon
                        const isActive = index === currentStep
                        const isDone = index < currentStep

                        return (
                            <button
                                key={step.key}
                                type="button"
                                onClick={() => {
                                    if (index <= currentStep || canGoNext()) {
                                        navigateStep(index)
                                    }
                                }}
                                className={`
                                    flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider
                                    transition-all duration-300 cursor-pointer
                                    ${isActive
                                        ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20'
                                        : isDone
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-gray-100 text-gray-400'
                                    }
                                `}
                            >
                                <StepIcon size={14} />
                                <span className="hidden sm:inline">{step.label}</span>
                            </button>
                        )
                    })}
                </div>

                {/* Step Content */}
                <div className="flex-1 relative">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={currentStep}
                            custom={direction}
                            variants={stepVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                        >
                            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100/60">
                                {/* STEP 0: Basics */}
                                {currentStep === 0 && (
                                    <div className="space-y-6">
                                        <div className="space-y-1">
                                            <h2 className="text-xl font-bold text-gray-900">The Basics</h2>
                                            <p className="text-sm text-gray-400">Let&apos;s start simple.</p>
                                        </div>

                                        <div className="space-y-5">
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 ml-1">Full Name</label>
                                                <input
                                                    value={fullName}
                                                    onChange={(e) => setFullName(e.target.value)}
                                                    type="text"
                                                    required
                                                    className="w-full p-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 text-gray-900 font-medium transition-all outline-none"
                                                    placeholder="Your name"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 ml-1">Age</label>
                                                    <input
                                                        value={age}
                                                        onChange={(e) => setAge(e.target.value)}
                                                        type="number"
                                                        min="13"
                                                        max="120"
                                                        required
                                                        className="w-full p-4 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 text-gray-900 font-medium transition-all outline-none"
                                                        placeholder="25"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 ml-1">Gender</label>
                                                    <select
                                                        value={gender}
                                                        onChange={(e) => setGender(e.target.value)}
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
                                )}

                                {/* STEP 1: Vibe Sliders */}
                                {currentStep === 1 && (
                                    <div className="space-y-6">
                                        <div className="space-y-1">
                                            <h2 className="text-xl font-bold text-gray-900">Your Vibe</h2>
                                            <p className="text-sm text-gray-400">Where do you fall on the spectrum?</p>
                                        </div>
                                        <VibeSliders value={sliders} onChange={setSliders} />
                                    </div>
                                )}

                                {/* STEP 2: Identity Chips */}
                                {currentStep === 2 && (
                                    <div className="space-y-6">
                                        <div className="space-y-1">
                                            <h2 className="text-xl font-bold text-gray-900">Your Identity</h2>
                                            <p className="text-sm text-gray-400">Pick up to 5 that define you.</p>
                                        </div>
                                        <IdentityChipCloud value={identityChips} onChange={setIdentityChips} />
                                    </div>
                                )}

                                {/* STEP 3: Prompt + AI Summary */}
                                {currentStep === 3 && (
                                    <div className="space-y-6">
                                        <div className="space-y-1">
                                            <h2 className="text-xl font-bold text-gray-900">Your Story</h2>
                                            <p className="text-sm text-gray-400">Answer a prompt, get your AI bio.</p>
                                        </div>
                                        <PromptRoulette
                                            promptAnswer={promptAnswer}
                                            onPromptAnswerChange={setPromptAnswer}
                                            aiSummary={aiSummary}
                                            onAiSummaryChange={setAiSummary}
                                            sliders={sliders}
                                            identityChips={identityChips}
                                        />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Bottom Navigation */}
                <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 p-4 z-50">
                    <div className="max-w-2xl mx-auto flex items-center justify-between">
                        <button
                            type="button"
                            onClick={handleBack}
                            disabled={currentStep === 0}
                            className={`
                                flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold
                                transition-all duration-200
                                ${currentStep === 0
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                }
                            `}
                        >
                            <ChevronLeft size={16} />
                            Back
                        </button>

                        {/* Step dots (mobile) */}
                        <div className="flex items-center gap-1.5">
                            {STEPS.map((_, index) => (
                                <div
                                    key={index}
                                    className={`
                                        h-1.5 rounded-full transition-all duration-300
                                        ${index === currentStep
                                            ? 'w-6 bg-gray-900'
                                            : index < currentStep
                                                ? 'w-1.5 bg-emerald-400'
                                                : 'w-1.5 bg-gray-200'
                                        }
                                    `}
                                />
                            ))}
                        </div>

                        {currentStep < STEPS.length - 1 ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={!canGoNext()}
                                className={`
                                    flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold
                                    transition-all duration-200 shadow-lg
                                    ${!canGoNext()
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                                        : 'bg-gray-900 text-white hover:bg-black active:scale-95'
                                    }
                                `}
                            >
                                Continue
                                <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isPending}
                                className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-200/50 hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-70"
                            >
                                {isPending ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        Save Profile
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
