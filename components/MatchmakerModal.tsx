'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Sparkles, Loader2, ArrowRight } from 'lucide-react'
import { askMatchmaker, MatchmakerResponse } from '@/app/actions/matchmaker'
import { createMatchConversation } from '@/app/actions/chat'
import { useRouter } from 'next/navigation'

interface MatchmakerModalProps {
    isOpen: boolean
    onClose: () => void
}

type Message = {
    role: 'user' | 'model'
    content: string
}

export default function MatchmakerModal({ isOpen, onClose }: MatchmakerModalProps) {
    const [input, setInput] = useState('')
    // FIX 1: Initialize with a static greeting so the AI doesn't jump the gun
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: "Hey! I'm Trio. Tell me a bit about what you're looking for, and I'll see who I know." }
    ])
    const [loading, setLoading] = useState(false)
    const [matchData, setMatchData] = useState<MatchmakerResponse | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, loading])

    // (Deleted the old useEffect that called askMatchmaker([]) on load)

    const handleSend = async () => {
        if (!input.trim() || loading) return

        const userMsg = input.trim()
        setInput('')
        setLoading(true)

        // Optimistic update
        const newHistory: Message[] = [...messages, { role: 'user', content: userMsg }]
        setMessages(newHistory)

        try {
            const response = await askMatchmaker(newHistory)

            if (response.matchFound) {
                setMatchData(response)
                setMessages(prev => [...prev, { role: 'model', content: response.reply }])
            } else {
                setMessages(prev => [...prev, { role: 'model', content: response.reply }])
            }

        } catch (error) {
            console.error(error)
            setMessages(prev => [...prev, { role: 'model', content: "Sorry, I got a bit distracted. Can you say that again?" }])
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleRevealMatch = async () => {
        if (!matchData?.matchId || !matchData?.introMessage) return

        setLoading(true)
        try {
            const conversationId = await createMatchConversation(matchData.matchId, matchData.introMessage)
            if (conversationId) {
                router.push(`/dashboard?conversationId=${conversationId}`)
                onClose()
            } else {
                console.error("Failed to create conversation (returned null)")
            }
        } catch (e) {
            console.error('Failed to create match', e)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[600px] border border-gray-100"
                >
                    {/* Header */}
                    <div className="h-16 bg-gradient-to-r from-primary/10 to-purple-500/10 border-b border-gray-100 flex items-center justify-between px-6 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <Sparkles size={18} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">Trio Matchmaker</h2>
                                <p className="text-xs text-gray-500">Finding your perfect fit</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50" ref={scrollRef}>
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`
                                    max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm
                                    ${msg.role === 'user'
                                        ? 'bg-primary text-white rounded-tr-none'
                                        : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                                    }
                                `}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-5 py-3 shadow-sm">
                                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                </div>
                            </div>
                        )}

                        {matchData?.matchFound && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="my-8 p-6 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl text-white text-center shadow-lg mx-4"
                            >
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                                    <Sparkles className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-2xl font-bold mb-2">It's a Match!</h3>
                                <p className="text-white/90 mb-6 text-sm">
                                    I've found someone who fits exactly what you're looking for.
                                </p>
                                <button
                                    onClick={handleRevealMatch}
                                    className="w-full bg-white text-primary font-bold py-3 px-6 rounded-xl shadow-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2 group"
                                >
                                    <span>Meet Them Now</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </motion.div>
                        )}
                    </div>

                    {/* Input Area */}
                    {!matchData?.matchFound && (
                        <div className="p-4 bg-white border-t border-gray-100">
                            <div className="relative flex items-center gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type a message..."
                                    disabled={loading}
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                    autoFocus
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || loading}
                                    className="p-3 bg-primary text-white rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}