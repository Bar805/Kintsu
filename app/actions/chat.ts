'use server'

import { createClient } from '@/utils/supabase/server'
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

    // 2. Fetch conversation details and ALL participants for these conversations
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

    // 3. For each conversation, find the partner (the participant that is NOT the current user)
    // And fetch their profile details
    const conversationsWithDetails: ConversationWithDetails[] = []

    for (const conv of conversations) {
        // Determine the partner ID
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
            id: id || undefined, // Use provided ID if available
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
