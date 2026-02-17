'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { getPendingMatchForUser } from '@/app/actions/matchmaker'
import { createBrowserClient } from '@supabase/ssr'
import MatchCard from './MatchCard'

export default function MatchNotification() {
    const [pendingMatch, setPendingMatch] = useState<any>(null)
    const [showCard, setShowCard] = useState(false)

    const fetchPending = async () => {
        try {
            const match = await getPendingMatchForUser()
            setPendingMatch(match)
        } catch (err) {
            console.error('Error fetching pending match:', err)
        }
    }

    useEffect(() => {
        fetchPending()
    }, [])

    // Listen for realtime updates
    useEffect(() => {
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const channel = supabase
            .channel('match-notification')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'match_requests',
                },
                () => {
                    fetchPending()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    if (!pendingMatch) return null

    return (
        <>
            <AnimatePresence>
                <motion.button
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    onClick={() => setShowCard(true)}
                    className="w-full bg-charcoal text-white p-4 rounded-2xl shadow-xl flex items-center justify-between hover:scale-[1.02] transition-transform mb-6"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-mustard rounded-full flex items-center justify-center text-charcoal font-bold">
                            <Sparkles size={20} />
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-sm">Match Found!</p>
                            <p className="text-xs text-gray-400">
                                Someone wants to connect with you.
                            </p>
                        </div>
                    </div>
                    <ArrowRight size={20} className="text-mustard" />
                </motion.button>
            </AnimatePresence>

            {showCard && pendingMatch && (
                <MatchCard
                    requestId={pendingMatch.id}
                    matchReason={pendingMatch.match_reason || 'Kintsu thinks you two would get along!'}
                    requesterProfile={pendingMatch.requester_profile}
                    onClose={() => setShowCard(false)}
                    onResponded={() => {
                        setShowCard(false)
                        setPendingMatch(null)
                    }}
                />
            )}
        </>
    )
}
