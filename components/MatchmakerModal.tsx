'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Sparkles, Loader2 } from 'lucide-react'
import { chatWithMatchmaker } from '@/app/actions/matchmaker'
import { toast } from 'sonner'

interface MatchmakerModalProps {
    isOpen: boolean
    onClose: () => void
    existingRequestId?: string | null
    onSearchStarted?: () => void
}

type Message = {
    role: 'user' | 'model'
    content: string
}

export default function MatchmakerModal({ isOpen, onClose, existingRequestId, onSearchStarted }: MatchmakerModalProps) {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: "Hey! Ready for a new connection?\n\nTell me, who are you looking to meet?" }
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [requestId, setRequestId] = useState<string | null>(existingRequestId || null)
    const [searchStarted, setSearchStarted] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, loading])

    // Reset when modal opens
    useEffect(() => {
        if (isOpen && !existingRequestId) {
            setMessages([
                { role: 'model', content: "Hey! Ready for a new connection?\n\nTell me, who are you looking to meet?" }
            ])
            setRequestId(null)
            setSearchStarted(false)
        }
    }, [isOpen, existingRequestId])

    const handleSend = async () => {
        if (!input.trim() || loading || searchStarted) return
        const userMsg = input.trim()
        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: userMsg }])
        setLoading(true)

        try {
            const result = await chatWithMatchmaker(userMsg, requestId || undefined)
            setRequestId(result.requestId)
            setMessages(prev => [...prev, { role: 'model', content: result.reply }])

            if (result.readyToSearch) {
                setSearchStarted(true)
                // Auto-close after a brief moment
                setTimeout(() => {
                    onSearchStarted?.()
                    onClose()
                }, 2500)
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
                            <div className="w-8 h-8 rounded-full bg-mustard border border-charcoal flex items-center justify-center text-charcoal">
                                <Sparkles size={16} />
                            </div>
                            <div>
                                <h2 className="font-bold text-charcoal text-sm">Kintsu Host</h2>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                    {searchStarted ? 'Searching...' : 'New Search'}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-sand rounded-full transition-colors text-gray-400 hover:text-charcoal">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto px-4 py-6" ref={scrollRef}>
                        <div className="space-y-6">
                            {messages.map((msg, idx) => {
                                const isAi = msg.role === 'model'
                                if (isAi) {
                                    return (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex flex-col w-full items-center"
                                        >
                                            <div className="bg-mustard/20 border border-mustard/50 p-6 rounded-3xl text-center max-w-[95%] relative">
                                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-mustard text-charcoal text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full">
                                                    Kintsu Host
                                                </div>
                                                <p className="text-charcoal text-sm font-medium leading-relaxed whitespace-pre-wrap">
                                                    {msg.content}
                                                </p>
                                            </div>
                                        </motion.div>
                                    )
                                }
                                return (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex flex-col items-end"
                                    >
                                        <div className="p-4 max-w-[85%] text-sm font-medium leading-relaxed shadow-sm bg-rust text-white rounded-t-2xl rounded-bl-2xl">
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                        </div>
                                    </motion.div>
                                )
                            })}

                            {loading && (
                                <div className="flex flex-col w-full items-start ml-1">
                                    <div className="bg-white px-4 py-3 rounded-tr-2xl rounded-bl-2xl rounded-br-2xl shadow-sm border-l-4 border-mustard">
                                        <div className="flex space-x-1 h-2 items-center justify-center">
                                            <div className="w-1.5 h-1.5 bg-mustard rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                            <div className="w-1.5 h-1.5 bg-mustard rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                            <div className="w-1.5 h-1.5 bg-mustard rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {searchStarted && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex justify-center"
                                >
                                    <div className="bg-charcoal text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-lg">
                                        <Loader2 size={16} className="animate-spin text-mustard" />
                                        <span className="text-sm font-bold">Scanning network...</span>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>

                    {/* Input Area */}
                    {!searchStarted && (
                        <div className="p-4 bg-white border-t border-sand">
                            <div className="flex items-center gap-2">
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