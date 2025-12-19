'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Message, ConversationWithDetails } from '@/types/database'
import { sendMessage } from '@/app/actions/chat'
import { ArrowLeft, Send, Sparkles, User, Info, Phone, Video } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

interface ChatWindowProps {
    conversation: ConversationWithDetails
    initialMessages: Message[]
    currentUserId: string
}

export default function ChatWindow({ conversation, initialMessages, currentUserId }: ChatWindowProps) {
    const [messages, setMessages] = useState<Message[]>(initialMessages)
    const [newMessage, setNewMessage] = useState('')
    const [isSending, setIsSending] = useState(false)
    const endRef = useRef<HTMLDivElement>(null)

    // Initialize Supabase client for Realtime
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    useEffect(() => {
        // Scroll to bottom on mount and when messages change
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        // Realtime subscription
        const channel = supabase
            .channel(`chat:${conversation.id}`)
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
                        // Prevent duplicates
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

        // Optimistic update
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
            // Rollback on error
            setMessages(prev => prev.filter(m => m.id !== tempId))
            setNewMessage(content) // Restore text
        } finally {
            setIsSending(false)
        }
    }

    return (
        <div className="flex h-full flex-col bg-[#F8FAFC]">
            {/* Header - iMessage style */}
            <div className="h-16 px-4 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard" className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full">
                        <ArrowLeft size={22} />
                    </Link>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 overflow-hidden border border-gray-100">
                                {conversation.partner_avatar ? (
                                    <img src={conversation.partner_avatar} alt={conversation.partner_name} className="w-full h-full object-cover" />
                                ) : (
                                    <User size={20} />
                                )}
                            </div>
                            {/* Online Status Dot (Fake for now) */}
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-sm font-semibold text-gray-900 leading-tight">
                                {conversation.partner_name || 'Unknown'}
                            </h2>
                            <span className="text-xs text-gray-400 font-medium">iMessage</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 text-blue-500">
                    <button className="hover:bg-blue-50 p-2 rounded-full transition-colors"><Video size={22} /></button>
                    <button className="hover:bg-blue-50 p-2 rounded-full transition-colors"><Info size={22} /></button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="text-center py-6">
                    <span className="text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                        Today {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                </div>

                <AnimatePresence initial={false}>
                    {messages.map((msg, index) => {
                        const isMe = msg.sender_id === currentUserId
                        const isAi = msg.is_ai_generated
                        const showAvatar = !isMe && (index === 0 || messages[index - 1].sender_id !== msg.sender_id)

                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`flex max-w-[75%] ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>

                                    {/* Avatar for partner (only show if first in group) */}
                                    {!isMe && (
                                        <div className="w-8 h-8 shrink-0 pb-1">
                                            {showAvatar && (
                                                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 overflow-hidden text-xs">
                                                    {isAi ? <Sparkles size={14} className="text-ai" /> : (
                                                        conversation.partner_avatar ? <img src={conversation.partner_avatar} alt="" className="w-full h-full object-cover" /> : conversation.partner_name?.[0]
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-1">
                                        {/* Name for AI */}
                                        {isAi && (
                                            <span className="text-[10px] font-bold text-ai uppercase tracking-wider ml-3 mb-0.5 flex items-center gap-1">
                                                <Sparkles size={10} /> Trio Suggestion
                                            </span>
                                        )}

                                        <div
                                            className={`
                                                px-4 py-2.5 shadow-sm text-[15px] leading-relaxed relative
                                                ${isMe
                                                    ? 'bg-primary text-white rounded-2xl rounded-tr-sm'
                                                    : isAi
                                                        ? 'bg-amber-50/80 text-gray-800 border border-amber-100/50 rounded-2xl rounded-tl-sm'
                                                        : 'bg-white text-gray-900 border border-gray-200/50 rounded-2xl rounded-tl-sm'
                                                }
                                            `}
                                        >
                                            {msg.content}
                                        </div>

                                        {/* Status / Time */}
                                        {isMe && (
                                            <div className="text-[10px] text-gray-300 text-right pr-1">
                                                Delivered
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
                <div ref={endRef} className="h-4" />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white/80 backdrop-blur-xl border-t border-gray-200 sticky bottom-0 z-20">
                <form
                    onSubmit={handleSend}
                    className="flex items-center gap-3 max-w-4xl mx-auto w-full"
                >
                    <button type="button" className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <span className="text-lg font-light leading-none pb-1">+</span>
                        </div>
                    </button>

                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="iMessage"
                            className="
                                w-full h-10 bg-gray-100 border border-transparent 
                                rounded-full pl-4 pr-10 
                                focus:outline-none focus:bg-white focus:border-gray-300 focus:ring-2 focus:ring-primary/10 
                                transition-all text-gray-800 placeholder-gray-400
                            "
                        />
                        {/* Send Button inside Input */}
                        <AnimatePresence>
                            {newMessage.trim() && (
                                <motion.button
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0, opacity: 0 }}
                                    type="submit"
                                    className="absolute right-1 top-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white hover:bg-blue-800 transition-colors shadow-sm"
                                >
                                    <ArrowLeft size={16} className="rotate-90 hidden" /> {/* Hack to preload? No, use Send */}
                                    <span className="font-bold text-xs"><ArrowLeft size={16} className="rotate-90" /></span>
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>
                </form>
            </div>
        </div>
    )
}