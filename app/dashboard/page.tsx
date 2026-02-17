import { createClient } from '@/utils/supabase/server'
import { Message } from '@/types/database'
import { getConversations, getMessages } from '@/app/actions/chat'
import ChatWindow from '@/components/ChatWindow'
import ConversationList from '@/components/ConversationList'
import MatchmakerTrigger from '@/components/MatchmakerTrigger'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Home, User, Settings, Bell, Plus, Sparkles } from 'lucide-react'

type Props = {
    searchParams: Promise<{ conversationId?: string }>
}

export default async function DashboardPage(props: Props) {
    const searchParams = await props.searchParams
    const selectedConversationId = searchParams.conversationId

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/')
    }

    const conversations = await getConversations()
    const selectedConversation = conversations.find(c => c.id === selectedConversationId)

    let initialMessages: Message[] = []
    if (selectedConversationId) {
        initialMessages = await getMessages(selectedConversationId)
    }

    // If a conversation is selected, show full-screen chat
    if (selectedConversationId && selectedConversation) {
        return (
            <div className="h-[100dvh] bg-cream overflow-hidden font-sans">
                <ChatWindow
                    conversation={selectedConversation}
                    initialMessages={initialMessages}
                    currentUserId={user.id}
                />
            </div>
        )
    }

    // Card-based home screen
    return (
        <div className="flex flex-col h-[100dvh] bg-cream font-sans text-charcoal">
            {/* Header */}
            <div className="px-6 py-5 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-1">
                    <div className="w-5 h-5 rounded-full bg-rust"></div>
                    <div className="w-5 h-5 bg-teal"></div>
                    <span className="font-bold text-xl tracking-tight ml-2">kintsu</span>
                </div>
                <div className="w-10 h-10 bg-white rounded-full border border-sand flex items-center justify-center relative">
                    <Bell className="w-5 h-5 text-charcoal" />
                </div>
            </div>

            {/* Main Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 no-scrollbar">
                {/* Request Connection Card */}
                <div className="mb-8">
                    <MatchmakerTrigger />
                </div>

                {/* Active Chats Section */}
                <ConversationList initialConversations={conversations} currentUserId={user.id} />
            </div>

            {/* Bottom Nav */}
            <div className="h-20 border-t border-sand flex items-center justify-around px-6 bg-white shrink-0">
                <button className="flex flex-col items-center gap-1 text-rust">
                    <Home className="w-6 h-6 fill-current" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
                </button>
                <Link href="/dashboard/profile" className="flex flex-col items-center gap-1 text-gray-300 hover:text-charcoal transition-colors">
                    <User className="w-6 h-6" />
                </Link>
                <button className="flex flex-col items-center gap-1 text-gray-300 hover:text-charcoal transition-colors">
                    <Settings className="w-6 h-6" />
                </button>
            </div>
        </div>
    )
}