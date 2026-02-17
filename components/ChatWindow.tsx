'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Message, ConversationWithDetails } from '@/types/database'
import { sendMessage } from '@/app/actions/chat'
import { generateTrioResponse } from '@/app/actions/ai'
import { ArrowRight, Sparkles, User, Send } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'

interface ChatWindowProps {
    conversation: ConversationWithDetails
    initialMessages: Message[]
    currentUserId: string
}

export default function ChatWindow({ conversation, initialMessages, currentUserId }: ChatWindowProps) {
    const [messages, setMessages] = useState<Message[]>(initialMessages)
    const [newMessage, setNewMessage] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [isAiLoading, setIsAiLoading] = useState(false)
    const endRef = useRef<HTMLDivElement>(null)

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        setMessages(initialMessages)
        setNewMessage('')
    }, [conversation.id, initialMessages])

    useEffect(() => {
        const channel = supabase
            .channel(`chat:${conversation.id}:${currentUserId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversation.id}`
                },
                (payload) => {
                    const newMsg = payload.new as Message
                    setMessages((current) => {
                        if (current.find(m => m.id === newMsg.id)) return current
                        return [...current, newMsg]
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [conversation.id, supabase])

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!newMessage.trim() || isSending) return

        setIsSending(true)
        const tempId = crypto.randomUUID()
        const content = newMessage.trim()

        const optimisticMsg: Message = {
            id: tempId,
            conversation_id: conversation.id,
            sender_id: currentUserId,
            content: content,
            created_at: new Date().toISOString(),
            is_ai_generated: false
        }

        setMessages(prev => [...prev, optimisticMsg])
        setNewMessage('')

        try {
            await sendMessage(conversation.id, content, tempId)
        } catch (err) {
            console.error('Failed to send:', err)
            toast.error('Failed to send message. Please try again.')
            setMessages(prev => prev.filter(m => m.id !== tempId))
            setNewMessage(content)
        } finally {
            setIsSending(false)
        }
    }

    const handleAiTrigger = async () => {
        if (isAiLoading) return
        setIsAiLoading(true)
        toast.info('Kintsu is thinking...')
        try {
            await generateTrioResponse(conversation.id)
            toast.success('Kintsu responded!')
        } catch (error) {
            console.error('AI generation failed', error)
            toast.error('Kintsu failed to respond.')
        } finally {
            setIsAiLoading(false)
        }
    }

    return (
        <div className="flex h-full flex-col bg-cream">
            {/* Header */}
            <div className="bg-cream border-b border-sand px-6 py-4 z-10 sticky top-0">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard" className="mr-1">
                            <ArrowRight className="w-4 h-4 rotate-180 text-gray-400" />
                        </Link>
                        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-rust p-0.5">
                            {conversation.partner_avatar ? (
                                <img
                                    src={conversation.partner_avatar}
                                    className="w-full h-full object-cover rounded-full"
                                    alt={conversation.partner_name}
                                />
                            ) : (
                                <div className="w-full h-full rounded-full bg-rust flex items-center justify-center text-white font-bold text-sm">
                                    {conversation.partner_name?.[0] || '?'}
                                </div>
                            )}
                        </div>
                        <div className="leading-tight">
                            <h1 className="text-lg font-bold text-charcoal">{conversation.partner_name || 'Unknown'}</h1>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-teal">Online</p>
                        </div>
                    </div>
                    <button
                        onClick={handleAiTrigger}
                        disabled={isAiLoading}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isAiLoading ? 'bg-mustard/30' : 'bg-mustard hover:scale-105'}`}
                        title="Ask Kintsu"
                    >
                        <Sparkles className={`w-5 h-5 text-charcoal ${isAiLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth">
                <div className="space-y-8">
                    <AnimatePresence initial={false}>
                        {messages.map((msg, index) => {
                            const trioId = process.env.NEXT_PUBLIC_TRIO_USER_ID
                            const isTrio = msg.sender_id === trioId
                            const isMe = msg.sender_id === currentUserId
                            const isAi = msg.is_ai_generated

                            const alignRight = isMe && !isAi && !isTrio

                            // AI / Kintsu message — centered card
                            if (isTrio || isAi) {
                                return (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex flex-col w-full items-center animate-fade-in relative"
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

                            // User or Partner message
                            return (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className={`flex flex-col ${alignRight ? 'items-end' : 'items-start'} animate-scale-in`}
                                >
                                    <div
                                        className={`p-4 max-w-[85%] text-sm font-medium leading-relaxed shadow-sm ${alignRight
                                            ? 'bg-rust text-white rounded-t-2xl rounded-bl-2xl'
                                            : 'bg-white text-charcoal border border-sand rounded-t-2xl rounded-br-2xl'
                                            }`}
                                    >
                                        {msg.content}
                                    </div>
                                    <span className="text-[10px] font-bold uppercase mt-1 text-gray-400 mx-1">
                                        {new Date(msg.created_at).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                    <div ref={endRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-cream border-t border-sand sticky bottom-0 z-20">
                <form onSubmit={handleSend} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-white border border-sand h-12 px-5 rounded-full text-sm font-medium placeholder-gray-400 focus:outline-none focus:border-rust transition-colors"
                    />
                    {newMessage.trim() && (
                        <button
                            type="submit"
                            className="w-12 h-12 bg-charcoal text-white rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    )}
                </form>
            </div>
        </div>
    )
}