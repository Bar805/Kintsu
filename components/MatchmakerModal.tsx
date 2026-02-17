'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Sparkles, Loader2, ArrowRight } from 'lucide-react'
import { askMatchmaker, MatchmakerResponse } from '@/app/actions/matchmaker'
import { createMatchConversation } from '@/app/actions/chat'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface MatchmakerModalProps {
    isOpen: boolean
    onClose: () => void
}

type Message = {
    role: 'user' | 'model'
    content: string
}

export default function MatchmakerModal({ isOpen, onClose }: MatchmakerModalProps) {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: "Hey! I'm Kintsu — tell me who you want to meet. What kind of connection are you looking for?" }
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [matchData, setMatchData] = useState<MatchmakerResponse | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, loading])

    const handleSend = async () => {
        if (!input.trim() || loading) return
        const userMsg = input.trim()
        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: userMsg }])
        setLoading(true)

        try {
            const history = [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user' as const, content: userMsg }]
            const result = await askMatchmaker(history)

            setMessages(prev => [...prev, { role: 'model', content: result.reply }])

            if (result.matchFound) {
                setMatchData(result)
            }
        } catch (error) {
            console.error('Matchmaker error:', error)
            setMessages(prev => [...prev, { role: 'model', content: "Sorry, I hit a snag. Try again?" }])
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
        if (!matchData?.matchId) return
        setLoading(true)
        try {
            const convoId = await createMatchConversation(matchData.matchId!)
            toast.success(`You're now connected! 🎉`, { duration: 3000 })
            onClose()
            router.push(`/dashboard?conversationId=${convoId}`)
            router.refresh()
        } catch (error: any) {
            console.error('Failed to create conversation:', error)
            toast.error(error.message || 'Failed to start conversation')
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
                    className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[600px] border border-sand"
                >
                    {/* Header */}
                    <div className="h-16 bg-cream border-b border-sand flex items-center justify-between px-6 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-mustard flex items-center justify-center text-charcoal">
                                <Sparkles size={18} />
                            </div>
                            <div>
                                <h2 className="font-bold text-charcoal">Kintsu Matchmaker</h2>
                                <p className="text-xs text-gray-400 font-medium">Finding your perfect fit</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-sand rounded-full transition-colors text-gray-400 hover:text-charcoal">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-cream" ref={scrollRef}>
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`
                                    max-w-[80%] px-5 py-3 text-sm leading-relaxed shadow-sm font-medium
                                    ${msg.role === 'user'
                                        ? 'bg-rust text-white rounded-t-2xl rounded-bl-2xl'
                                        : 'bg-white text-charcoal border border-sand rounded-t-2xl rounded-br-2xl'
                                    }
                                `}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-sand rounded-t-2xl rounded-br-2xl px-5 py-3 shadow-sm">
                                    <div className="flex space-x-1 h-2 items-center justify-center">
                                        <div className="w-1.5 h-1.5 bg-mustard rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <div className="w-1.5 h-1.5 bg-mustard rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <div className="w-1.5 h-1.5 bg-mustard rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {matchData?.matchFound && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="my-8 p-6 bg-charcoal rounded-3xl text-white text-center shadow-xl mx-4"
                            >
                                <div className="w-16 h-16 bg-mustard rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Sparkles className="w-8 h-8 text-charcoal" />
                                </div>
                                <h3 className="text-2xl font-bold mb-2">It's a Match!</h3>
                                <p className="text-white/70 mb-6 text-sm font-medium">
                                    I've found someone who fits exactly what you're looking for.
                                </p>
                                <button
                                    onClick={handleRevealMatch}
                                    className="w-full bg-rust text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-rust/90 transition-all flex items-center justify-center gap-2 group"
                                >
                                    <span>Meet Them Now</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </motion.div>
                        )}
                    </div>

                    {/* Input Area */}
                    {!matchData?.matchFound && (
                        <div className="p-4 bg-white border-t border-sand">
                            <div className="relative flex items-center gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type a message..."
                                    disabled={loading}
                                    className="flex-1 bg-cream border border-sand rounded-full px-5 py-3 focus:outline-none focus:border-rust transition-all text-sm font-medium"
                                    autoFocus
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || loading}
                                    className="p-3 bg-charcoal text-white rounded-full hover:bg-rust disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
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