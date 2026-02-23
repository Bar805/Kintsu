'use client'

import { createClient } from '@/utils/supabase/client'
import { ConversationWithDetails } from '@/types/database'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { MessageSquare, Archive } from 'lucide-react'

type Props = {
    activeConversations: ConversationWithDetails[]
    archivedConversations: ConversationWithDetails[]
    currentUserId: string
}

const AVATAR_COLORS = ['#D95D39', '#2B6B6E', '#F0C419', '#2D2D2D']

export default function ConversationList({ activeConversations, archivedConversations, currentUserId }: Props) {
    const router = useRouter()

    useEffect(() => {
        const localSupabase = createClient()
        const channel = localSupabase
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
            localSupabase.removeChannel(channel)
        }
    }, [router, currentUserId])

    const renderConversationCard = (chat: ConversationWithDetails, index: number, isArchived: boolean) => {
        const initial = chat.partner_name ? chat.partner_name[0].toUpperCase() : '?'
        const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length]

        return (
            <Link
                href={`/dashboard?conversationId=${chat.id}`}
                key={chat.id}
                className={`w-full text-left flex items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm transition-all cursor-pointer group ${isArchived
                        ? 'border-sand/60 opacity-60 hover:opacity-80'
                        : 'border-sand hover:border-rust hover:shadow-md'
                    }`}
            >
                {/* Avatar */}
                <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 ${isArchived ? 'grayscale' : ''}`}
                    style={{ backgroundColor: avatarColor }}
                >
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
                        {isArchived ? 'Archived' : 'Click to view chat'}
                    </p>
                </div>
            </Link>
        )
    }

    return (
        <div className="space-y-6">
            {/* Active Chats Section */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-rust" />
                    <span className="text-xs font-bold uppercase tracking-widest text-charcoal">
                        Active Chats
                    </span>
                </div>

                {activeConversations.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10 text-sm">
                        <p>Your matches will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {activeConversations.map((chat, index) =>
                            renderConversationCard(chat, index, false)
                        )}
                    </div>
                )}
            </div>

            {/* Archived Chats Section */}
            {archivedConversations.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Archive className="w-4 h-4 text-gray-400" />
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                            Archived Chats
                        </span>
                    </div>
                    <div className="space-y-3">
                        {archivedConversations.map((chat, index) =>
                            renderConversationCard(chat, index, true)
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
