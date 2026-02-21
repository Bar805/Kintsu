import { vi } from 'vitest'

/**
 * Creates a chainable Supabase query builder mock.
 * Each method returns the builder itself so you can chain .from().select().eq() etc.
 * Set the final result with `mockResult()`.
 *
 * Usage:
 *   const query = createQueryMock({ data: [...], error: null })
 *   // query.from('messages').select('*').eq('id', '123') → resolves to { data, error }
 */
export function createQueryMock(defaultResult: { data: any; error: any; count?: number } = { data: null, error: null }) {
    let result = { ...defaultResult }

    const builder: any = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn(() => Promise.resolve(result)),
        maybeSingle: vi.fn(() => Promise.resolve(result)),
        // Make the builder itself thenable so `await supabase.from(...).select(...)` resolves
        then: vi.fn((resolve: any) => resolve(result)),
    }

    // Helper to change the result mid-test
    builder.mockResult = (newResult: { data: any; error: any; count?: number }) => {
        result = { ...newResult }
        builder.then = vi.fn((resolve: any) => resolve(result))
        builder.single = vi.fn(() => Promise.resolve(result))
        builder.maybeSingle = vi.fn(() => Promise.resolve(result))
    }

    return builder
}

/**
 * Creates a mock Supabase client (server or browser).
 * Pass a query mock to control what database calls return.
 */
export function createMockSupabaseClient(queryMock?: ReturnType<typeof createQueryMock>) {
    const query = queryMock ?? createQueryMock()

    return {
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: 'test-user-id', email: 'test@example.com' } },
                error: null,
            }),
            signOut: vi.fn().mockResolvedValue({ error: null }),
            onAuthStateChange: vi.fn().mockReturnValue({
                data: { subscription: { unsubscribe: vi.fn() } },
            }),
        },
        from: query.from,
        channel: vi.fn().mockReturnValue({
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
        }),
        removeChannel: vi.fn(),
        // Expose the query mock for chaining setup
        _query: query,
    }
}

/**
 * Sets up vi.mock for the server-side Supabase client.
 * Returns the mock client so you can customize behavior per test.
 *
 * Call this at the top of your test file:
 *   const { mockClient } = setupServerClientMock()
 */
export function setupServerClientMock() {
    const mockClient = createMockSupabaseClient()

    vi.mock('@/utils/supabase/server', () => ({
        createClient: vi.fn().mockResolvedValue(mockClient),
    }))

    return { mockClient }
}

/**
 * Sets up vi.mock for the browser-side Supabase client.
 */
export function setupBrowserClientMock() {
    const mockClient = createMockSupabaseClient()

    vi.mock('@/utils/supabase/client', () => ({
        createClient: vi.fn(() => mockClient),
    }))

    return { mockClient }
}
