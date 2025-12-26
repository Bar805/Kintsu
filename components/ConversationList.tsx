'use client'

import { createClient } from '@/utils/supabase/client'
import { ConversationWithDetails } from '@/types/database'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

type Props = {
    initialConversations: ConversationWithDetails[]
    currentUserId: string
}

export default function ConversationList({ initialConversations, currentUserId }: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const selectedConversationId = searchParams.get('conversationId')
    const supabase = createClient()

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
    }, [supabase, router, currentUserId])

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {initialConversations.length === 0 ? (
                <div className="text-center text-gray-400 mt-10 text-sm">
                    <p>No conversations yet.</p>
                </div>
            ) : (
                initialConversations.map(chat => {
                    const isActive = chat.id === selectedConversationId
                    // Fallback initial if avatar is missing
                    const initial = chat.partner_name ? chat.partner_name[0].toUpperCase() : '?'

                    return (
                        <Link
                            href={`/dashboard?conversationId=${chat.id}`}
                            key={chat.id}
                            className={`
                                flex items-center p-3 rounded-xl transition-all duration-200
                                ${isActive ? 'bg-blue-50 border-blue-100 shadow-sm' : 'hover:bg-gray-50 border border-transparent'}
                            `}
                        >
                            {/* Avatar */}
                            <div className="mr-4 relative shrink-0">
                                <div className={`
                                    w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold shadow-sm
                                    ${isActive ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'}
                                `}>
                                    {chat.partner_avatar ? (
                                        <img src={chat.partner_avatar} alt="avatar" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        initial
                                    )}
                                </div>
                            </div>

                            {/* Text Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-1">
                                    <h3 className={`font-semibold truncate ${isActive ? 'text-primary' : 'text-gray-900'}`}>
                                        {chat.partner_name}
                                    </h3>
                                    <span className="text-xs text-gray-400 font-medium">
                                        {new Date(chat.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 truncate leading-relaxed">
                                    Click to view chat
                                </p>
                            </div>
                        </Link>
                    )
                })
            )}
        </div>
    )
}
