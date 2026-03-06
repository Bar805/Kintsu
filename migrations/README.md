# Database Migrations

This folder contains SQL migration files for the Supabase database.

## How to Run Migrations

These migrations are currently **manual** - you need to:
1. Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql)
2. Copy the contents of a migration file
3. Paste and execute it

## Migration Files

Migrations are numbered in chronological/dependency order:

1. `001_initial_schema.sql` - Initial schema setup (empty placeholder, tables likely created via Supabase dashboard initially)
2. `002_update_profiles_schema.sql` - Add basic profile fields (bio, age, gender, interests, looking_for)
3. `003_identity_stack.sql` - Add advanced profile fields (sliders, identity_chips, prompt_answer, ai_summary)
4. `004_split_name.sql` - Split `full_name` into `first_name`/`last_name`
5. `005_match_requests.sql` - Create match_requests table and state machine
6. `006_chat_features.sql` - Add timer, interest tracking, and meetup suggestions to conversations
7. `007_archive_timer.sql` - Add `user_ids_who_messaged` tracking to conversations
8. `008_add_intro_message.sql` - Add `intro_message` column to match_requests

## Important Notes

- **No automatic tracking**: Unlike Prisma, there's no built-in system to track which migrations have run
- **Idempotency**: Many migrations use `IF NOT EXISTS` or `ADD COLUMN IF NOT EXISTS` to be safe to run multiple times
- **RLS & Policies**: Most migrations include Row Level Security (RLS) policies
- **Realtime**: Some migrations enable realtime subscriptions for tables

## Future: Automated Migrations

See the `.agent/workflows/supabase.md` for information on setting up automated migration execution via Node.js scripts.
