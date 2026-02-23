import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function resetMeetup() {
    // 1. Find the most recent conversation
    const { data: convs, error: convErr } = await supabase
        .from('conversations')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)

    if (convErr || !convs || convs.length === 0) {
        console.error('Could not find latest conversation', convErr)
        return
    }

    const conversationId = convs[0].id
    console.log(`Resetting Meetup State for Conversation: ${conversationId}`)

    // 2. Reset the conversation triggers
    const { error: updateErr } = await supabase
        .from('conversations')
        .update({
            interested_user_ids: [],
            meetup_suggested: false,
            meetup_trigger_after: null
        })
        .eq('id', conversationId)

    if (updateErr) {
        console.error('Failed to reset conversation state', updateErr)
        return
    }

    // 3. Delete the AI meetup message (to clean up the chat UI)
    const { error: deleteErr } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId)
        .like('content', '%[MEETUP_PLACES]%')

    if (deleteErr) {
        console.error('Failed to delete meetup message', deleteErr)
    }

    console.log('✅ Successfully reset! You can now click "Interested" again in the UI.')
}

resetMeetup()
