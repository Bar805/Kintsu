import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing env vars')
    process.exit(1)
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function createTrioAgent() {
    const email = 'ai@trio.app'
    const password = 'system-agent-do-not-login-123'
    const name = 'Trio'

    console.log(`🤖 Ensuring System Agent '${name}' exists...`)

    // 1. Check if exists via Admin
    // (We'll just try to create and catch the error, or list and find)
    const { data: { users } } = await supabase.auth.admin.listUsers()
    let trioUser = users.find(u => u.email === email)

    if (!trioUser) {
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: name }
        })
        if (error) {
            console.error('Failed to create Trio:', error)
            return
        }
        trioUser = data.user
        console.log('✅ Created new Trio User.')
    } else {
        console.log('ℹ️ Trio User already exists.')
    }

    if (!trioUser) return

    // 2. Ensure Profile Exists
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: trioUser.id,
            email: email,
            full_name: name,
            avatar_url: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Trio', // distinct robot avatar
            bio: 'I am your AI Wingman.',
            age: 99,
            gender: 'Robot'
        })

    if (profileError) {
        console.error('Profile Error:', profileError)
    } else {
        console.log('✅ Trio Profile Synced.')
    }

    console.log('\nCopy this ID into your .env.local file:')
    console.log(`NEXT_PUBLIC_TRIO_USER_ID=${trioUser.id}`)
}

createTrioAgent()