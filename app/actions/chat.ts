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

    const profileMap = new Map<string, { full_name: string; avatar_url: string }>()

    if (partnerIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', partnerIds)

        if (profiles) {
            for (const profile of profiles) {
                profileMap.set(profile.id, {
                    full_name: profile.full_name || 'Unknown',
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
            partner_name: profile?.full_name || 'Unknown',
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

    // --- TIMER RESET (alternating sender only) ---
    try {
        const { data: conv } = await adminClient
            .from('conversations')
            .select('last_message_sender_id, meetup_trigger_after, meetup_suggested')
            .eq('id', conversationId)
            .single()

        if (conv) {
            const updatePayload: any = { last_message_sender_id: user.id }

            // Only reset timer if a DIFFERENT user sent the last message
            if (conv.last_message_sender_id !== user.id) {
                updatePayload.timer_expires_at = new Date(
                    Date.now() + 24 * 60 * 60 * 1000
                ).toISOString()
            }

            await adminClient
                .from('conversations')
                .update(updatePayload)
                .eq('id', conversationId)

            // --- MEETUP TRIGGER CHECK ---
            if (conv.meetup_trigger_after && !conv.meetup_suggested) {
                const { count } = await adminClient
                    .from('messages')
                    .select('id', { count: 'exact', head: true })
                    .eq('conversation_id', conversationId)

                if (count && count >= conv.meetup_trigger_after) {
                    // Atomic claim: only the update that flips meetup_suggested false→true fires the suggestion
                    const { data: claimed } = await adminClient
                        .from('conversations')
                        .update({ meetup_suggested: true })
                        .eq('id', conversationId)
                        .eq('meetup_suggested', false)
                        .select('id')

                    if (claimed && claimed.length > 0) {
                        generateMeetupSuggestion(conversationId).catch(err =>
                            console.error('Meetup suggestion error:', err)
                        )
                    }
                }
            }
        }
    } catch (e) {
        console.error('Timer/meetup update error:', e)
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
                .select('id, full_name, interests, bio')
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