# Authentication

## Purpose
Supabase Auth integration patterns for user authentication and session management.

## Scope
- **In scope:** Auth verification patterns, session handling
- **Out of scope:** User registration flow (implementation detail)

## Dependencies
- [Supabase Patterns](./supabase-patterns.md) for client usage

---

## Server Action Authentication

### Pattern
```typescript
export async function sendMessage(...): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return false

  // Proceed with authenticated user.id
}
```

### Rules
1. **Always verify:** Check auth in all server actions
2. **Early return:** Return error value if not authenticated
3. **Use user.id:** Use `user.id` as authenticated user identifier

---

## Middleware Authentication

### Pattern
```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request)
  await supabase.auth.getUser()
  return response
}
```

### Protected Routes
```typescript
export const config = {
  matcher: ['/dashboard/:path*']
}
```

---

## Environment Variables

```bash
# Public (client-accessible)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...

# Server-only
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

---

## Acceptance Criteria

- [ ] All server actions verify authentication
- [ ] Unauthenticated requests return error values
- [ ] Protected routes use middleware
- [ ] Service role key never exposed to client
