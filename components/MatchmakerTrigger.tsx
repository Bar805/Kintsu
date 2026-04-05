'use client'

import { useState, useEffect } from 'react'
import MatchmakerModal from './MatchmakerModal'
import { Sparkles, Plus, Loader2, AlertCircle } from 'lucide-react'
import { getActiveMatchRequest, clearMatchRequestError, type MatchRequest } from '@/app/actions/matchmaker'
import { createBrowserClient } from '@supabase/ssr'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function MatchmakerTrigger() {
    const [isOpen, setIsOpen] = useState(false)
    const [activeRequest, setActiveRequest] = useState<MatchRequest | null>(null)
    const [loading, setLoading] = useState(true)
    const [clearing, setClearing] = useState(false)

    const fetchActiveRequest = async () => {
        try {
            const request = await getActiveMatchRequest()
            setActiveRequest(request)
        } catch (err) {
            console.error('Error fetching active request:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchActiveRequest()
    }, [])

    // Listen for realtime updates to match_requests
    useEffect(() => {
        const channel = supabase
            .channel('match-request-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'match_requests',
                },
                () => {
                    fetchActiveRequest()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const handleSearchStarted = () => {
        // Refresh the active request after search starts
        setTimeout(() => fetchActiveRequest(), 500)
    }

    const handleClearError = async () => {
        if (!activeRequest) return

        setClearing(true)
        try {
            const result = await clearMatchRequestError(activeRequest.id)
            if (result.success) {
                setActiveRequest(null)
                setIsOpen(true)
                toast.success('Ready to try again!')
            } else {
                toast.error('Failed to clear error. Please refresh the page.')
            }
        } catch (err) {
            console.error('Error clearing match request:', err)
            toast.error('Something went wrong. Please try again.')
        } finally {
            setClearing(false)
        }
    }

    const isPending = activeRequest && ['searching', 'pending_approval'].includes(activeRequest.status)
    const isChatting = activeRequest && activeRequest.status === 'chatting'
    const noResults = activeRequest && activeRequest.status === 'no_candidates'
    const hasError = activeRequest && activeRequest.status === 'error'

    if (loading) {
        return (
            <div className="w-full bg-white border border-sand rounded-3xl p-6 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300 mx-auto" />
            </div>
        )
    }

    // Error state — show error message with retry option
    if (hasError) {
        return (
            <motion.button
                onClick={handleClearError}
                disabled={clearing}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full bg-white border-2 border-rust rounded-3xl p-6 text-left shadow-sm hover:shadow-md transition-all group disabled:opacity-50"
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-rust/10 rounded-full flex items-center justify-center">
                        {clearing ? (
                            <Loader2 className="w-6 h-6 text-rust animate-spin" />
                        ) : (
                            <AlertCircle className="w-6 h-6 text-rust" />
                        )}
                    </div>
                </div>
                <h2 className="text-2xl font-bold mb-1 text-charcoal">Something Went Wrong</h2>
                <p className="text-sm text-gray-500 font-medium mb-3">
                    {activeRequest.error_message || 'Failed to find matches. Please try again.'}
                </p>
                <p className="text-xs text-rust font-medium">
                    {clearing ? 'Clearing...' : 'Click to try again'}
                </p>
            </motion.button>
        )
    }

    // Pending state — AI is searching or waiting for approval
    if (isPending) {
        return (
            <>
                <motion.button
                    onClick={() => setIsOpen(true)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full bg-charcoal text-white rounded-3xl p-6 text-left shadow-lg hover:shadow-xl transition-all group"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-mustard rounded-full flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-charcoal animate-spin" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold mb-1">Finding Your Match...</h2>
                    <p className="text-sm text-gray-400 font-medium">
                        {activeRequest.status === 'searching'
                            ? "Kintsu is scanning the network for you."
                            : "Waiting for your match to respond."
                        }
                    </p>
                </motion.button>

                <MatchmakerModal
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                    existingRequestId={activeRequest.id}
                    onSearchStarted={handleSearchStarted}
                />
            </>
        )
    }

    // No candidates found
    if (noResults) {
        return (
            <button
                onClick={() => {
                    setActiveRequest(null)
                    setIsOpen(true)
                }}
                className="w-full bg-white border border-sand rounded-3xl p-6 text-left shadow-sm hover:border-rust hover:shadow-md transition-all group"
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-sand rounded-full flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-gray-400" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold mb-1 text-charcoal">No Matches Found</h2>
                <p className="text-sm text-gray-500 font-medium">
                    Try a different type of connection.
                </p>
            </button>
        )
    }

    // Default state — request a new connection
    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="w-full bg-white border border-sand rounded-3xl p-6 text-left shadow-sm hover:border-rust hover:shadow-md transition-all group"
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-mustard rounded-full flex items-center justify-center border border-mustard">
                        <Plus className="w-6 h-6 text-charcoal" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold mb-1 text-charcoal">Request Connection</h2>
                <p className="text-sm text-gray-500 font-medium">
                    Tell Kintsu who you want to meet.
                </p>
            </button>

            <MatchmakerModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                existingRequestId={isChatting ? activeRequest?.id : null}
                onSearchStarted={handleSearchStarted}
            />
        </>
    )
}
