import { createClient } from '@/utils/supabase/server'
import { Message } from '@/types/database'
import { getConversations, getMessages } from '@/app/actions/chat'
import ChatWindow from '@/components/ChatWindow'
import MatchmakerTrigger from '@/components/MatchmakerTrigger'
import ConversationList from '@/components/ConversationList'
import Link from 'next/link'
import { redirect } from 'next/navigation'

// Define the Props type for Next.js 15+
type Props = {
    searchParams: Promise<{ conversationId?: string }>
}

export default async function DashboardPage(props: Props) {
    // 1. Await the params (Fix for Next.js 15)
    const searchParams = await props.searchParams
    const selectedConversationId = searchParams.conversationId

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/')
    }

    // 2. Fetch data
    const conversations = await getConversations()
    const selectedConversation = conversations.find(c => c.id === selectedConversationId)

    let initialMessages: Message[] = []
    if (selectedConversationId) {
        initialMessages = await getMessages(selectedConversationId)
    }

    return (
        <div className="flex h-[100dvh] bg-gray-50 overflow-hidden font-sans">
            {/* Sidebar */}
            <div className={`
                w-full md:w-80 lg:w-96 bg-white border-r border-gray-200 flex flex-col 
                ${selectedConversationId ? 'hidden md:flex' : 'flex'}
            `}>
                {/* Header */}
                <div className="h-16 px-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <h1 className="text-2xl font-bold text-primary tracking-tight">Trio</h1>

                    <div className="flex items-center gap-2">
                        {/* Matchmaker Trigger */}


                        {/* NEW Profile Link */}
                        <Link href="/dashboard/profile" className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors">
                            {/* User Icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        </Link>
                    </div>
                </div>

                {/* Matchmaker CTA */}
                <div className="p-4 pb-0">
                    <MatchmakerTrigger />
                </div>

                {/* Conversation List */}
                <ConversationList initialConversations={conversations} currentUserId={user.id} />
            </div>

            {/* Main Chat Area */}
            <div className={`flex-1 flex flex-col h-full bg-white relative ${!selectedConversationId ? 'hidden md:flex' : 'flex'}`}>
                {selectedConversationId && selectedConversation ? (
                    <ChatWindow
                        conversation={selectedConversation}
                        initialMessages={initialMessages}
                        currentUserId={user.id}
                    />
                ) : (
                    // Empty State
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                        </div>
                        <p className="text-lg font-medium text-gray-400">Select a conversation to start chatting</p>
                    </div>
                )}
            </div>
        </div>
    )
}