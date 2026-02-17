---
description: How to interact with Supabase directly (query schema, run migrations, manage data)
---

# Supabase Direct Interaction

Instead of asking the user to copy-paste SQL into the Supabase dashboard, use Node.js scripts with the service role key to interact with Supabase directly.

## Setup
- Supabase URL and keys are in `.env.local`
- Use `@supabase/supabase-js` (already installed) with the service role key
- Always use `.mjs` extension for standalone scripts (ESM)

## Running Raw SQL (Migrations, DDL, Schema Changes)

Create a temporary `.mjs` script and run it:

```js
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

// For raw SQL, use the rpc endpoint or the REST API
const { data, error } = await supabase.rpc('exec_sql', { sql: 'YOUR SQL HERE' })
```

**NOTE**: Raw SQL via `rpc` requires a helper function. If it doesn't exist, create it first via the Supabase Management API or ask the user to run this ONE setup SQL:
```sql
CREATE OR REPLACE FUNCTION exec_sql(sql text) RETURNS json AS $$
BEGIN RETURN (SELECT json_agg(row_to_json(t)) FROM (EXECUTE sql) t);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
```

Alternatively, use the Supabase Management API:
```js
const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: 'YOUR SQL HERE' })
})
```

## Common Operations

### Query table data
```js
const { data } = await supabase.from('profiles').select('*').limit(5)
```

### Create/delete auth users
```js
await supabase.auth.admin.createUser({ email, password, email_confirm: true })
await supabase.auth.admin.deleteUser(userId)
```

### List users
```js
const { data } = await supabase.auth.admin.listUsers()
```

### Update table data
```js
await supabase.from('profiles').update({ full_name: 'New Name' }).eq('id', userId)
```

## Cleanup
// turbo
Always delete temporary scripts after running them:
```powershell
Remove-Item script_name.mjs
```

## Important
- Scripts use the SERVICE ROLE KEY which bypasses RLS — be careful with destructive operations
- Always clean up temporary scripts after use
- The service role key is already in .env.local, read it from there using dotenv
