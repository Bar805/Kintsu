import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

const personas = [
    {
        email: 'sarah.chen@yale.edu',
        password: 'password123',
        full_name: 'Sarah Chen',
        age: 24,
        gender: 'Female',
        bio: 'MBA candidate at Yale SOM. Passionate about sustainable venture capital and finding the best matcha in New Haven. Love hiking East Rock on weekends.',
        interests: ['Hiking', 'Venture Capital', 'Matcha', 'Sustainability', 'Startups'],
        looking_for: 'A co-founder for my climate-tech idea or just someone to hike with.'
    },
    {
        email: 'mike.ross@yale.edu',
        password: 'password123',
        full_name: 'Mike Ross',
        age: 26,
        gender: 'Male',
        bio: 'Yale Law. I argue for a living, but I promise I\'m chill outside of class. Big chess nerd and cycling enthusiast.',
        interests: ['Chess', 'Debate', 'Cycling', 'Law', 'Jazz'],
        looking_for: 'Intellectually stimulating conversation and maybe a chess partner.'
    },
    {
        email: 'emily.blunt@yale.edu',
        password: 'password123',
        full_name: 'Emily Blunt',
        age: 21,
        gender: 'Female',
        bio: 'English Lit major at Yale College. I spend most of my time in the library or rehearsing for the next Dramat production.',
        interests: ['Theatre', 'Poetry', 'Baking', 'Literature', 'Vintage Shopping'],
        looking_for: 'Creative collaborators or someone to explore bookstores with.'
    },
    {
        email: 'david.kim@yale.edu',
        password: 'password123',
        full_name: 'David Kim',
        age: 29,
        gender: 'Male',
        bio: 'PhD in Computer Science focused on Generative AI. When I\'m not coding, I\'m probably at the gym or playing Overwatch.',
        interests: ['AI', 'Gaming', 'Electronic Music', 'Squash', 'Coding'],
        looking_for: 'A squash partner or someone who wants to talk about the future of tech.'
    },
    {
        email: 'olivia.wilson@yale.edu',
        password: 'password123',
        full_name: 'Olivia Wilson',
        age: 23,
        gender: 'Female',
        bio: 'Med student trying to survive anatomy lab. I play piano to de-stress and love long runs.',
        interests: ['Running', 'Piano', 'Volunteering', 'Medicine', 'Coffee'],
        looking_for: 'A study buddy or someone to motivate me to train for a half-marathon.'
    },
    {
        email: 'james.sterling@yale.edu',
        password: 'password123',
        full_name: 'James Sterling',
        age: 22,
        gender: 'Male',
        bio: 'Economics major. Rowing team. Interested in finance and fintech. Always down for a whiskey tasting.',
        interests: ['Rowing', 'Finance', 'Whiskey', 'Golf', 'Travel'],
        looking_for: 'Networking and meeting ambitious people.'
    },
    {
        email: 'sophia.patel@yale.edu',
        password: 'password123',
        full_name: 'Sophia Patel',
        age: 25,
        gender: 'Female',
        bio: 'M.Arch student at the School of Architecture. I love brutalist buildings and sketch comedy.',
        interests: ['Photography', 'Architecture', 'Sketch Comedy', 'Design', 'Museums'],
        looking_for: 'Anyone who wants to critique buildings or catch a comedy show.'
    },
    {
        email: 'lucas.mendez@yale.edu',
        password: 'password123',
        full_name: 'Lucas Mendez',
        age: 27,
        gender: 'Male',
        bio: 'MFA in Acting. I love improv, spicy food, and cooking elaborate dinners for friends.',
        interests: ['Acting', 'Improv', 'Cooking', 'Movies', 'Salsa Dancing'],
        looking_for: 'Someone to practice lines with or cook dinner for.'
    }
]

async function seedUsers() {
    console.log('🌱 Starting user seeding...')

    for (const persona of personas) {
        try {
            // 1. Create User in Auth
            // Check if user exists first to avoid error log spam (though createUser handles duplicates by erroring)
            // But admin.createUser doesn't have a "check" easily without listUsers, so we'll just try/catch the specific error if needed
            // Or just try to create.

            let userId: string | null = null;

            // Try to find if user exists by email first? 
            // supabase.auth.admin.listUsers() is pagination based. 
            // Faster to just try create and catch error, OR just overwrite.
            // Using createUser.

            const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
                email: persona.email,
                password: persona.password,
                email_confirm: true,
                user_metadata: { full_name: persona.full_name }
            })

            if (createError) {
                // If error is "User already registered", we need to fetch their ID to update profile
                // But the error doesn't always give ID.
                // We'll search for them.
                if (createError.message.includes('already has')) {
                    // console.log(`User ${persona.email} exists, fetching ID...`)
                    // We can't easily exact match email with listUsers without filtering client side usually, 
                    // but listUsers supports query? No, just page.
                    // Actually, usually we can't "get" a user by email easily in admin without loop? 
                    // No, wait, generateLink or similar might work but that's messy.
                    // Best way: listUsers and filter? Or assume we can just ignore or update if we had the ID.
                    // For mock seeding, let's just skip updating if they exist to be safe/simple, 
                    // OR try to delete and recreate?
                    // Let's print existing and skip.
                    console.log(`⚠️  User ${persona.full_name} (${persona.email}) already exists. Skipping creation.`)
                    // To update them we'd need their ID. 
                    // Let's try to fetch all users and find match (okay for small seed list)
                    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
                    const existing = users.find(u => u.email === persona.email)
                    if (existing) {
                        userId = existing.id
                        console.log(`   -> Found ID: ${userId}. Updating profile...`)
                    }
                } else {
                    console.error(`❌ Failed to create ${persona.full_name}:`, createError.message)
                    continue
                }
            } else {
                userId = createdUser.user.id
                console.log(`✅ Created Auth User: ${persona.full_name}`)
            }

            if (userId) {
                // 2. Update Profile
                // The trigger might have created the profile row, or we create/update it here.
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        full_name: persona.full_name,
                        age: persona.age,
                        gender: persona.gender,
                        bio: persona.bio,
                        interests: persona.interests,
                        looking_for: persona.looking_for,
                        avatar_url: `https://api.dicebear.com/9.x/initials/svg?seed=${persona.full_name}` // Nice placeholder
                    })
                    .eq('id', userId)

                if (profileError) {
                    console.error(`   ❌ Failed to update profile for ${persona.full_name}:`, profileError.message)
                } else {
                    console.log(`   ✨ Updated Profile for ${persona.full_name}`)
                }
            }

        } catch (err) {
            console.error('Unexpected error:', err)
        }
    }

    console.log('🏁 Seeding complete.')
}

seedUsers()
