'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Loader2, Edit3, RefreshCw } from 'lucide-react'
import type { PromptAnswer, VibeSliders } from '@/types/database'
import { generateIdentitySummary } from '@/app/actions/profile'

interface PromptRouletteProps {
    promptAnswer: PromptAnswer | null
    onPromptAnswerChange: (pa: PromptAnswer) => void
    aiSummary: string
    onAiSummaryChange: (summary: string) => void
    sliders: VibeSliders
    identityChips: string[]
}

const PROMPTS = [
    'My controversial opinion is...',
    "I'm obsessed with...",
    'Perfect Sunday looks like...',
]

export default function PromptRoulette({
    promptAnswer,
    onPromptAnswerChange,
    aiSummary,
    onAiSummaryChange,
    sliders,
    identityChips,
}: PromptRouletteProps) {
    const [selectedPrompt, setSelectedPrompt] = useState<string | null>(promptAnswer?.prompt || null)
    const [answer, setAnswer] = useState(promptAnswer?.answer || '')
    const [isGenerating, setIsGenerating] = useState(false)
    const [hasGenerated, setHasGenerated] = useState(!!aiSummary)

    const handleSelectPrompt = (prompt: string) => {
        setSelectedPrompt(prompt)
        setAnswer('')
        onPromptAnswerChange({ prompt, answer: '' })
    }

    const handleAnswerChange = (val: string) => {
        setAnswer(val)
        if (selectedPrompt) {
            onPromptAnswerChange({ prompt: selectedPrompt, answer: val })
        }
    }

    const handleGenerate = async () => {
        if (!selectedPrompt || !answer.trim()) return

        setIsGenerating(true)
        try {
            const result = await generateIdentitySummary(sliders, identityChips, {
                prompt: selectedPrompt,
                answer: answer.trim(),
            })

            if (result.summary) {
                onAiSummaryChange(result.summary)
                setHasGenerated(true)
            } else {
                const { toast } = await import('sonner')
                toast.error(result.error || 'AI generation failed. Try again!')
            }
        } catch (err) {
            console.error('Generation failed:', err)
            const { toast } = await import('sonner')
            toast.error('Something went wrong. Please try again.')
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Prompt Cards */}
            <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-charcoal">
                    Pick a prompt
                </p>
                <div className="grid gap-3">
                    {PROMPTS.map((prompt, index) => {
                        const isActive = selectedPrompt === prompt
                        return (
                            <motion.button
                                key={prompt}
                                type="button"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.08, duration: 0.3 }}
                                onClick={() => handleSelectPrompt(prompt)}
                                className={`
                                    w-full text-left p-4 rounded-2xl border-2 transition-all duration-200
                                    ${isActive
                                        ? 'border-rust bg-rust/5 shadow-md'
                                        : 'border-sand bg-white hover:border-rust/40 hover:shadow-sm'
                                    }
                                `}
                            >
                                <span className={`text-base font-semibold ${isActive ? 'text-rust' : 'text-charcoal'}`}>
                                    {prompt}
                                </span>
                            </motion.button>
                        )
                    })}
                </div>
            </div>

            {/* Answer Area */}
            <AnimatePresence>
                {selectedPrompt && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-4">
                            <textarea
                                value={answer}
                                onChange={(e) => handleAnswerChange(e.target.value)}
                                placeholder="Type your answer here..."
                                rows={3}
                                className="w-full p-4 bg-cream border border-sand rounded-2xl focus:bg-white focus:ring-2 focus:ring-rust/20 focus:border-rust text-charcoal font-medium transition-all resize-none outline-none placeholder:text-gray-400"
                                maxLength={280}
                            />
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400 font-medium">
                                    {answer.length}/280
                                </span>
                                <motion.button
                                    type="button"
                                    disabled={!answer.trim() || isGenerating}
                                    onClick={handleGenerate}
                                    whileTap={{ scale: 0.95 }}
                                    className={`
                                        inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm
                                        transition-all duration-200 shadow-lg
                                        ${!answer.trim() || isGenerating
                                            ? 'bg-sand text-gray-400 cursor-not-allowed shadow-none'
                                            : 'bg-charcoal text-white hover:bg-rust hover:shadow-xl active:scale-95'
                                        }
                                    `}
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={16} className="text-mustard" />
                                            {hasGenerated ? 'Regenerate Bio' : 'Generate My Bio'}
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AI Summary Display */}
            <AnimatePresence>
                {hasGenerated && aiSummary && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        className="space-y-3"
                    >
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-mustard rounded-lg">
                                <Sparkles size={14} className="text-charcoal" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest text-charcoal">Your AI Bio</span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                <Edit3 size={10} /> editable
                            </span>
                        </div>

                        <div className="relative">
                            <textarea
                                value={aiSummary}
                                onChange={(e) => onAiSummaryChange(e.target.value)}
                                rows={4}
                                className="w-full p-5 bg-mustard/10 border-2 border-mustard/40 rounded-2xl text-charcoal font-medium leading-relaxed transition-all resize-none outline-none focus:ring-2 focus:ring-mustard/20 focus:border-mustard"
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
