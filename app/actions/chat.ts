'use server'

import { createClient } from '@/utils/supabase/server'
// NEW: Import the raw client generator for Admin usage
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ConversationWithDetails, Message, Participant } from '@/types/database'
import { evaluateConversationState, generateTrioResponse, UserProfile } from './ai'
import { generateMeetupSuggestion } from './chat-suggestions'

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

    // 3. Collect all partner user IDs and batch-fetch profiles
    const partnerIds = conversations
        .map(conv => conv.participants.find((p: Participant) => p.user_id !== user.id)?.user_id)
        .filter((id): id is string => !!id)

    const profileMap = new Map<string, { first_name: string; avatar_url: string }>()

    if (partnerIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, avatar_url')
            .in('id', partnerIds)

        if (profiles) {
            for (const profile of profiles) {
                profileMap.set(profile.id, {
                    first_name: profile.first_name || 'Unknown',
                    avatar_url: profile.avatar_url || '',
                })
            }
        }
    }

    const conversationsWithDetails: ConversationWithDetails[] = conversations.map(conv => {
        const partner = conv.participants.find((p: Participant) => p.user_id !== user.id)
        const profile = partner ? profileMap.get(partner.user_id) : undefined

        return {
            id: conv.id,
            created_at: conv.created_at,
            is_active: conv.is_active,
            timer_expires_at: conv.timer_expires_at || null,
            last_message_sender_id: conv.last_message_sender_id || null,
            interested_user_ids: conv.interested_user_ids || [],
            meetup_suggested: conv.meetup_suggested || false,
            meetup_trigger_after: conv.meetup_trigger_after || null,
            user_ids_who_messaged: conv.user_ids_who_messaged || [],
            partner_name: profile?.first_name || 'Unknown',
            partner_avatar: profile?.avatar_url || '',
        }
    })

    return conversationsWithDetails
}

export async function getMessages(conversationId: string): Promise<Message[]> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Verify the user is a participant in this conversation
    const { data: membership } = await supabase
        .from('participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .single()

    if (!membership) return []

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

    // Verify the user is a participant in this conversation
    const { data: membership } = await supabase
        .from('participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .single()

    if (!membership) return false

    const adminClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // --- CHECK IF CONVERSATION IS ARCHIVED ---
    const { data: convCheck } = await adminClient
        .from('conversations')
        .select('is_active')
        .eq('id', conversationId)
        .single()

    if (convCheck && !convCheck.is_active) {
        console.log('Cannot send message: conversation is archived')
        return false
    }

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

    // --- TRACK WHO HAS MESSAGED & CLEAR TIMER ---
    try {
        const { data: conv } = await adminClient
            .from('conversations')
            .select('user_ids_who_messaged, last_message_sender_id')
            .eq('id', conversationId)
            .single()

        if (conv) {
            const currentMessaged: string[] = conv.user_ids_who_messaged || []
            const updatedMessaged = currentMessaged.includes(user.id)
                ? currentMessaged
                : [...currentMessaged, user.id]

            // Get participant count to know when "both" have messaged
            const { data: participants } = await adminClient
                .from('participants')
                .select('user_id')
                .eq('conversation_id', conversationId)

            const participantIds = (participants || []).map(p => p.user_id)
            const allHaveMessaged = participantIds.every(pid => updatedMessaged.includes(pid))

            const updatePayload: any = {
                last_message_sender_id: user.id,
                user_ids_who_messaged: updatedMessaged,
            }

            // If all participants have messaged, clear the timer (chat is saved)
            if (allHaveMessaged) {
                updatePayload.timer_expires_at = null
            }

            await adminClient
                .from('conversations')
                .update(updatePayload)
                .eq('id', conversationId)
        }
    } catch (e) {
        console.error('Timer/tracking update error:', e)
    }

    // --- TRIGGER AI EVALUATION ---
    try {
        const { data: participants } = await supabase
            .from('participants')
            .select('user_id')
            .eq('conversation_id', conversationId)

        if (participants) {
            const userIds = participants.map(p => p.user_id)
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, first_name, interests, bio')
                .in('id', userIds)

            if (profiles) {
                const shouldSpeak = await evaluateConversationState(conversationId, profiles)
                if (shouldSpeak) {
                    await generateTrioResponse(conversationId, profiles)
                }
            }
        }
    } catch (e) {
        console.error('AI trigger error:', e)
    }

    return true
}

export async function createMatchConversation(matchId: string, introMessage?: string): Promise<string | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

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
        .insert({
            is_active: true,
            timer_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            user_ids_who_messaged: [],
        })
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

    // 4. Add Intro Message (Sent by TRIO) - ONLY IF EXISTS
    if (introMessage && introMessage.trim().length > 0) {
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
    }

    return conversation.id
}

// ─── Archive expired conversations ───────────────────────────────────────────

export async function archiveExpiredConversations(): Promise<number> {
    const adminClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const now = new Date().toISOString()

    const { data, error } = await adminClient
        .from('conversations')
        .update({ is_active: false })
        .eq('is_active', true)
        .not('timer_expires_at', 'is', null)
        .lt('timer_expires_at', now)
        .select('id')

    if (error) {
        console.error('Error archiving expired conversations:', error)
        return 0
    }

    if (data && data.length > 0) {
        console.log(`Archived ${data.length} expired conversation(s):`, data.map(c => c.id))
    }

    return data?.length || 0
}