'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Message, ConversationWithDetails } from '@/types/database'
import { sendMessage } from '@/app/actions/chat'
import { markInterested, getConversationMeta } from '@/app/actions/chat-suggestions'
import { ArrowRight, Sparkles, Send, Clock, Coffee, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'

const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface ChatWindowProps {
    conversation: ConversationWithDetails
    initialMessages: Message[]
    currentUserId: string
}

// ─── Helper: parse meetup cards from message content ─────────────────────────

interface MeetupPlace {
    name: string
    category: string
    mapsQuery: string
}

function parseMeetupPlaces(content: string): { text: string; places: MeetupPlace[] } | null {
    const match = content.match(/\[MEETUP_PLACES\]([\s\S]*?)\[\/MEETUP_PLACES\]/)
    if (!match) return null
    try {
        const places = JSON.parse(match[1]) as MeetupPlace[]
        const text = content.replace(/\n?\n?\[MEETUP_PLACES\][\s\S]*?\[\/MEETUP_PLACES\]/, '').trim()
        return { text, places }
    } catch {
        return null
    }
}

// ─── Helper: format countdown ────────────────────────────────────────────────

function formatCountdown(expiresAt: string | null): string {
    if (!expiresAt) return '24:00:00'
    const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now())
    const h = Math.floor(remaining / 3600000)
    const m = Math.floor((remaining % 3600000) / 60000)
    const s = Math.floor((remaining % 60000) / 1000)
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ChatWindow({ conversation, initialMessages, currentUserId }: ChatWindowProps) {
    const [messages, setMessages] = useState<Message[]>(initialMessages)
    const [newMessage, setNewMessage] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
    const [interested, setInterested] = useState(false)
    const [interestLoading, setInterestLoading] = useState(false)
    const [timerExpiry, setTimerExpiry] = useState<string | null>(conversation.timer_expires_at)
    const [countdown, setCountdown] = useState('24:00:00')
    const endRef = useRef<HTMLDivElement>(null)

    // ─── Scroll to bottom ────────────────────────────────────────────────────

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // ─── Reset on conversation change ────────────────────────────────────────

    useEffect(() => {
        setMessages(initialMessages)
        setNewMessage('')
        setSuggestions([])
        setTimerExpiry(conversation.timer_expires_at)
    }, [conversation.id, initialMessages])

    // ─── Load initial meta (interest state) ──────────────────────────────────

    useEffect(() => {
        getConversationMeta(conversation.id).then(meta => {
            setInterested(meta.isInterested)
            setTimerExpiry(meta.timerExpiresAt)
        }).catch(() => { })
    }, [conversation.id])

    // ─── Countdown timer tick ────────────────────────────────────────────────

    useEffect(() => {
        const tick = () => setCountdown(formatCountdown(timerExpiry))
        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [timerExpiry])

    // ─── Realtime message subscription ───────────────────────────────────────

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
    }, [conversation.id])

    // ─── Poll conversation meta when messages change (timer, interest) ────────

    useEffect(() => {
        const refreshMeta = async () => {
            try {
                const meta = await getConversationMeta(conversation.id)
                setTimerExpiry(meta.timerExpiresAt)
            } catch { }
        }
        refreshMeta()
    }, [conversation.id, messages.length])

    // ─── Fetch suggestions from API (icebreaker or on-demand reply) ──────────

    const fetchSuggestions = useCallback(async () => {
        setIsLoadingSuggestions(true)
        setSuggestions([])
        try {
            const res = await fetch(`/api/suggestions?conversationId=${conversation.id}`)
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                if (res.status === 429) {
                    toast('Suggestions are busy right now. Try again in a moment.', { duration: 3000 })
                } else {
                    console.error('[suggestions] API error:', res.status, body.detail || body.error)
                }
                return
            }
            const data = await res.json()
            setSuggestions(data.suggestions || [])
        } catch (err) {
            console.error('[suggestions] Fetch failed:', err)
        } finally {
            setIsLoadingSuggestions(false)
        }
    }, [conversation.id])

    // ─── Auto-load icebreakers when a new conversation has no messages ────────

    useEffect(() => {
        if (messages.length === 0) {
            fetchSuggestions()
        } else {
            setSuggestions([])
        }
    }, [conversation.id]) // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Send message ────────────────────────────────────────────────────────

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
        setSuggestions([])

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

    // ─── Handle suggestion click (populate input, don't send) ────────────────

    const handleSuggestionClick = (suggestion: string) => {
        setNewMessage(suggestion)
    }

    // ─── Handle interested click ─────────────────────────────────────────────

    const handleInterestClick = async () => {
        if (interestLoading) return
        setInterestLoading(true)
        try {
            const result = await markInterested(conversation.id)
            setInterested(result.interested)
            if (result.interested) {
                toast.success('Noted! ☕', { description: "We'll keep that between us." })
            } else {
                toast('Changed your mind? No worries.', { description: 'Interest removed.' })
            }
        } catch {
            toast.error('Something went wrong')
        } finally {
            setInterestLoading(false)
        }
    }

    // ─── Render ──────────────────────────────────────────────────────────────

    const trioId = process.env.NEXT_PUBLIC_TRIO_USER_ID

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
                                    alt={conversation.partner_name || ''}
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

                    {/* Timer */}
                    <div className="flex items-center gap-2 bg-sand/50 px-3 py-1.5 rounded-full">
                        <Clock className="w-3 h-3 text-rust" />
                        <span className="text-xs font-mono font-bold text-charcoal">
                            {countdown}
                        </span>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth">
                <div className="space-y-8">
                    <AnimatePresence initial={false}>
                        {messages.map((msg) => {
                            const isTrio = msg.sender_id === trioId
                            const isMe = msg.sender_id === currentUserId
                            const isAi = msg.is_ai_generated
                            const alignRight = isMe && !isAi && !isTrio

                            // AI / Kintsu message — centered card
                            if (isTrio || isAi) {
                                const meetup = parseMeetupPlaces(msg.content)

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
                                                {meetup ? meetup.text : msg.content}
                                            </p>

                                            {/* Meetup place cards */}
                                            {meetup && meetup.places.length > 0 && (
                                                <div className="mt-4 bg-cream rounded-2xl overflow-hidden border border-sand text-left">
                                                    <div className="bg-mustard p-3 flex items-center space-x-2">
                                                        <div className="w-2 h-2 rounded-full bg-charcoal" />
                                                        <span className="text-xs font-bold uppercase tracking-widest text-charcoal">
                                                            The Plan
                                                        </span>
                                                    </div>
                                                    <div className="p-1">
                                                        {meetup.places.map((place, i) => (
                                                            <a
                                                                key={i}
                                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.mapsQuery)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="w-full p-3 bg-white rounded-xl mb-1 last:mb-0 flex justify-between items-center border border-gray-100 hover:border-rust hover:shadow-sm transition-all cursor-pointer group text-left block"
                                                            >
                                                                <div className="flex flex-col items-start">
                                                                    <p className="font-bold text-sm text-charcoal">{place.name}</p>
                                                                    <p className="text-[10px] uppercase opacity-60 text-charcoal">
                                                                        {place.category}
                                                                    </p>
                                                                </div>
                                                                <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-rust transition-colors shrink-0" />
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
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

            {/* Footer */}
            <div className="bg-cream p-4 pb-8 sticky bottom-0 z-20 border-t border-sand relative">
                {/* Interested Button — floating above */}
                <div className="absolute left-0 right-0 -top-16 flex justify-center pointer-events-none">
                    <button
                        onClick={handleInterestClick}
                        disabled={interestLoading}
                        className={`pointer-events-auto flex items-center gap-3 px-8 py-3 rounded-full font-bold uppercase text-xs tracking-widest transition-all shadow-lg ${interested
                            ? 'bg-teal text-white ring-2 ring-offset-2 ring-teal hover:bg-teal/80'
                            : 'bg-white text-charcoal hover:bg-rust hover:text-white border border-sand'
                            } disabled:opacity-70`}
                    >
                        <Coffee className="w-4 h-4" />
                        {interestLoading ? '...' : interested ? 'Interested ✓' : 'Interested?'}
                    </button>
                </div>

                {/* Suggested Replies / Icebreakers */}
                <AnimatePresence>
                    {isLoadingSuggestions && (
                        <motion.div
                            key="shimmer"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="flex flex-col space-y-3 mb-4"
                        >
                            <div className="flex items-center space-x-2">
                                <Sparkles className="w-4 h-4 text-mustard fill-mustard animate-pulse" />
                                <span className="text-xs font-bold text-charcoal/40 uppercase tracking-widest">
                                    Thinking...
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="h-11 rounded-xl bg-sand/60 animate-pulse" />
                                <div className="h-11 rounded-xl bg-sand/60 animate-pulse" />
                            </div>
                        </motion.div>
                    )}
                    {!isLoadingSuggestions && suggestions.length > 0 && (
                        <motion.div
                            key="suggestions"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="flex flex-col space-y-3 mb-4"
                        >
                            <div className="flex items-center space-x-2">
                                <Sparkles className="w-4 h-4 text-mustard fill-mustard" />
                                <span className="text-xs font-bold text-charcoal uppercase tracking-widest">
                                    {messages.length === 0 ? 'Icebreakers' : 'Suggested Replies'}
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {suggestions.map((opt, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSuggestionClick(opt)}
                                        className="bg-white text-charcoal text-sm font-medium px-5 py-3 rounded-xl shadow-sm border border-sand hover:border-rust hover:text-rust transition-colors text-left flex items-center group"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-sand mr-3 group-hover:bg-rust transition-colors shrink-0" />
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Input */}
                <form onSubmit={handleSend} className="flex items-center gap-2">
                    {messages.length > 0 && (
                        <button
                            type="button"
                            onClick={fetchSuggestions}
                            disabled={isLoadingSuggestions}
                            title="Get AI suggestions"
                            className="w-12 h-12 bg-white border border-sand rounded-full flex items-center justify-center hover:border-mustard transition-colors disabled:opacity-50 shrink-0"
                        >
                            <Sparkles className={`w-5 h-5 ${isLoadingSuggestions ? 'animate-pulse text-mustard' : 'text-gray-400'}`} />
                        </button>
                    )}
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
                            disabled={isSending}
                            className="w-12 h-12 bg-charcoal text-white rounded-full flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    )}
                </form>
            </div>
        </div>
    )
}