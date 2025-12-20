'use server'

import { createClient } from '@/utils/supabase/server'
// NEW: Import the raw client generator for Admin usage
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ConversationWithDetails, Message } from '@/types/database'

export async function getConversations(): Promise<ConversationWithDetails[]> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // 1. Get all conversations the user is part of
    const { data: userConversations, error: userConvsError } = await supabase
        .from('participants')
        .select('conversation_id')
        .eq('user_id', user.id)

    if (userConvsError || !userConversations) {
        console.error('Error fetching user conversations:', userConvsError)
        return []
    }

    const conversationIds = userConversations.map(uc => uc.conversation_id)

    if (conversationIds.length === 0) return []

    // 2. Fetch conversation details
    const { data: conversations, error: convsError } = await supabase
        .from('conversations')
        .select(`
      *,
      participants (
        user_id,
        joined_at
      )
    `)
        .in('id', conversationIds)
        .order('created_at', { ascending: false })

    if (convsError || !conversations) {
        console.error('Error fetching conversations:', convsError)
        return []
    }

    // 3. For each conversation, find the partner details
    const conversationsWithDetails: ConversationWithDetails[] = []

    for (const conv of conversations) {
        const partner = conv.participants.find((p: any) => p.user_id !== user.id)

        let partnerName = 'Unknown'
        let partnerAvatar = ''

        if (partner) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', partner.user_id)
                .single()

            if (profile) {
                partnerName = profile.full_name || 'Unknown'
                partnerAvatar = profile.avatar_url || ''
            }
        }

        conversationsWithDetails.push({
            id: conv.id,
            created_at: conv.created_at,
            is_active: conv.is_active,
            partner_name: partnerName,
            partner_avatar: partnerAvatar,
        })
    }

    return conversationsWithDetails
}

export async function getMessages(conversationId: string): Promise<Message[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error fetching messages:', error)
        return []
    }

    return data as Message[]
}

export async function sendMessage(conversationId: string, content: string, id?: string): Promise<boolean> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return false

    const { error } = await supabase
        .from('messages')
        .insert({
            id: id || undefined,
            conversation_id: conversationId,
            sender_id: user.id,
            content,
            is_ai_generated: false
        })

    if (error) {
        console.error('Error sending message:', error)
        return false
    }

    return true
}

export async function createMatchConversation(matchId: string, introMessage: string): Promise<string | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null
    if (!introMessage || introMessage.trim().length === 0) return null

    // 1. Get the Trio ID from environment
    const trioId = process.env.NEXT_PUBLIC_TRIO_USER_ID
    if (!trioId) {
        console.error("CRITICAL: NEXT_PUBLIC_TRIO_USER_ID is not set in .env.local")
        return null
    }

    const adminSupabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 2. Create Conversation
    const { data: conversation, error: convError } = await adminSupabase
        .from('conversations')
        .insert({ is_active: true })
        .select()
        .single()

    if (convError || !conversation) return null

    // 3. Add Participants (User + Match)
    // NOTE: We do NOT add Trio as a participant. 
    // Trio is a "System Sender" who can post messages but isn't "in" the chat list.
    const { error: partError } = await adminSupabase
        .from('participants')
        .insert([
            { conversation_id: conversation.id, user_id: user.id },
            { conversation_id: conversation.id, user_id: matchId }
        ])

    if (partError) return null

    // 4. Add Intro Message (Sent by TRIO)
    const { error: msgError } = await adminSupabase
        .from('messages')
        .insert({
            conversation_id: conversation.id,
            sender_id: trioId, // <--- THE TRUTH
            content: introMessage,
            is_ai_generated: true
        })
        .select()

    if (msgError) console.error('Error sending intro message:', msgError)

    return conversation.id
}