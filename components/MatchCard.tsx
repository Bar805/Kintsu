'use client'

import { motion } from 'framer-motion'
import { ArrowRight, X, Sparkles, ChevronLeft } from 'lucide-react'
import { respondToMatch } from '@/app/actions/matchmaker'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

interface MatchCardProps {
    requestId: string
    matchReason: string
    requesterProfile: {
        id: string
        first_name: string
        age: number | null
        gender: string | null
        avatar_url: string | null
        identity_chips: string[] | null
        ai_summary: string | null
    }
    onClose: () => void
    onResponded: () => void
}

export default function MatchCard({ requestId, matchReason, requesterProfile, onClose, onResponded }: MatchCardProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const initials = `${requesterProfile.first_name?.[0] || ''}`.toUpperCase() || '?'

    const handleAccept = async () => {
        setLoading(true)
        try {
            const result = await respondToMatch(requestId, true)
            if (result.success && result.conversationId) {
                toast.success("You're connected! 🎉")
                onResponded()
                router.push(`/dashboard?conversationId=${result.conversationId}`)
                router.refresh()
            } else {
                toast.error(result.error || 'Something went wrong')
            }
        } catch (err) {
            toast.error('Failed to accept match')
        } finally {
            setLoading(false)
        }
    }

    const handleDecline = async () => {
        setLoading(true)
        try {
            const result = await respondToMatch(requestId, false)
            if (result.success) {
                toast('Match declined', { description: 'No worries — the search continues.' })
                onResponded()
                onClose()
            }
        } catch (err) {
            toast.error('Failed to decline')
        } finally {
            setLoading(false)
        }
    }

    // Parse match reason — take first 3 short bullets max
    const bullets = matchReason
        ?.split(/[\n•]/)
        .map(b => b.replace(/^[-]\s*/, '').trim())
        .filter(b => b.length > 0)
        .slice(0, 3) || []

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-cream flex flex-col h-[100dvh]"
        >
            {/* Header */}
            <div className="px-4 py-4 flex items-center gap-3 shrink-0">
                <button
                    onClick={onClose}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-sand"
                >
                    <ChevronLeft size={20} className="text-charcoal" />
                </button>
                <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-mustard" />
                    <span className="text-xs font-bold uppercase tracking-widest text-charcoal/60">
                        Kintsu Match
                    </span>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 no-scrollbar">
                {/* Avatar */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: 'spring', damping: 25 }}
                    className="w-full aspect-[4/5] max-h-[360px] rounded-3xl overflow-hidden bg-charcoal mb-5"
                >
                    {requesterProfile.avatar_url ? (
                        <img
                            src={requesterProfile.avatar_url}
                            alt={requesterProfile.first_name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-charcoal to-charcoal/80">
                            <span className="text-7xl font-bold text-white/20">{initials}</span>
                        </div>
                    )}
                </motion.div>

                {/* Name + Age */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="mb-4"
                >
                    <h1 className="text-3xl font-bold text-charcoal">
                        {requesterProfile.first_name}
                        {requesterProfile.age && (
                            <span className="text-xl font-normal text-charcoal/40 ml-2">
                                {requesterProfile.age}
                            </span>
                        )}
                    </h1>
                </motion.div>

                {/* Identity chips — max 3 */}
                {requesterProfile.identity_chips && requesterProfile.identity_chips.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex flex-wrap gap-2 mb-5"
                    >
                        {requesterProfile.identity_chips.slice(0, 3).map((chip) => (
                            <span
                                key={chip}
                                className="px-3 py-1.5 bg-rust/10 text-rust text-xs font-bold rounded-full border border-rust/20"
                            >
                                {chip}
                            </span>
                        ))}
                    </motion.div>
                )}

                {/* Why Kintsu matched you */}
                {bullets.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="bg-white border border-sand rounded-2xl p-4 space-y-2.5"
                    >
                        <p className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40 mb-1">
                            Why this match
                        </p>
                        {bullets.map((bullet, i) => (
                            <div key={i} className="flex items-start gap-2.5">
                                <div className={`mt-1.5 w-2 h-2 shrink-0 rounded-full ${i === 0 ? 'bg-rust' : i === 1 ? 'bg-mustard' : 'bg-teal'
                                    }`} />
                                <p className="text-sm text-charcoal/80 leading-snug">
                                    {bullet}
                                </p>
                            </div>
                        ))}
                    </motion.div>
                )}
            </div>

            {/* Fixed Action Buttons at Bottom */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="px-6 pb-8 pt-3 flex items-center gap-3 shrink-0 bg-cream border-t border-sand/50"
            >
                <button
                    onClick={handleDecline}
                    disabled={loading}
                    className="h-14 w-14 flex items-center justify-center rounded-full border border-sand bg-white text-gray-400 hover:border-charcoal hover:text-charcoal transition-all disabled:opacity-50 shrink-0"
                >
                    <X size={20} />
                </button>
                <button
                    onClick={handleAccept}
                    disabled={loading}
                    className="flex-1 h-14 bg-charcoal text-white font-bold text-base rounded-full flex items-center justify-center gap-2 hover:bg-rust transition-colors shadow-lg disabled:opacity-50"
                >
                    {loading ? 'Connecting...' : "Let's chat"}
                    {!loading && <ArrowRight size={18} />}
                </button>
            </motion.div>
        </motion.div>
    )
}
