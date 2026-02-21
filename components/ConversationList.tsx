'use client'

import { createClient } from '@/utils/supabase/client'
import { ConversationWithDetails } from '@/types/database'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { LogOut, MessageSquare } from 'lucide-react'

type Props = {
    initialConversations: ConversationWithDetails[]
    currentUserId: string
}

const AVATAR_COLORS = ['#D95D39', '#2B6B6E', '#F0C419', '#2D2D2D']

const supabase = createClient()

export default function ConversationList({ initialConversations, currentUserId }: Props) {
    const router = useRouter()

    useEffect(() => {
        const channel = supabase
            .channel('realtime-conversation-list')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'participants',
                    filter: `user_id=eq.${currentUserId}`,
                },
                (payload) => {
                    console.log('New conversation detected, refreshing...', payload)
                    router.refresh()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [router, currentUserId])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/')
        router.refresh()
    }

    return (
        <div className="space-y-4">
            {/* Section Header */}
            <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-rust" />
                <span className="text-xs font-bold uppercase tracking-widest text-charcoal">
                    Active Chats
                </span>
            </div>

            {initialConversations.length === 0 ? (
                <div className="text-center text-gray-400 mt-10 text-sm">
                    <p>Your matches will appear here.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {initialConversations.map((chat, index) => {
                        const initial = chat.partner_name ? chat.partner_name[0].toUpperCase() : '?'
                        const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length]

                        return (
                            <Link
                                href={`/dashboard?conversationId=${chat.id}`}
                                key={chat.id}
                                className="w-full text-left flex items-center gap-4 bg-white p-4 rounded-2xl border border-sand shadow-sm hover:border-rust hover:shadow-md transition-all cursor-pointer group"
                            >
                                {/* Avatar */}
                                <div
                                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                                    style={{ backgroundColor: avatarColor }}
                                >
                                    {/* {conversation.partner_name} */}
                                    {chat.partner_avatar ? (
                                        <img src={chat.partner_avatar} alt={chat.partner_name} className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        initial
                                    )}
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-bold text-sm text-charcoal truncate">{chat.partner_name || 'Unknown'}</h3>
                                        <span className="text-[10px] text-gray-400 font-medium">
                                            {new Date(chat.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 truncate">
                                        Click to view chat
                                    </p>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}

            {/* Logout */}
            <div className="pt-4 mt-4 border-t border-sand">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-charcoal transition-colors w-full px-2 py-2 rounded-lg hover:bg-cream"
                >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                </button>
            </div>
        </div>
    )
}
