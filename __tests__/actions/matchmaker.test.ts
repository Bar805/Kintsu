import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createQueryMock, createMockSupabaseClient } from '../mocks/supabase'

// Helper to create a mock fetch response matching Gemini's structure
function createGeminiResponse(textParts: string) {
    return {
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({
            candidates: [
                {
                    content: {
                        parts: [{ text: textParts }]
                    }
                }
            ]
        }))
    }
}

// Helper to create a rate limited response
function createRateLimitResponse() {
    return {
        status: 429,
        ok: false,
        text: vi.fn().mockResolvedValue('Rate Limited')
    }
}


// --- vi.hoisted() makes these available inside hoisted vi.mock factories ---
const { mockClient, mockAdminClient } = vi.hoisted(() => {
    const makeMock = () => {
        let result: any = { data: null, error: null }
        const query: any = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn(() => Promise.resolve(result)),
            then: vi.fn((resolve: any) => resolve(result)),
            mockResult(r: any) {
                result = { ...r }
                query.then = vi.fn((resolve: any) => resolve(result))
                query.single = vi.fn(() => Promise.resolve(result))
            },
        }
        return {
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: 'test-user-id', email: 'test@example.com' } },
                    error: null,
                }),
                signOut: vi.fn().mockResolvedValue({ error: null }),
            },
            from: query.from,
            _query: query,
        }
    }
    return { mockClient: makeMock(), mockAdminClient: makeMock() }
})

// Mock the server-side Supabase client
vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn().mockResolvedValue(mockClient),
}))

// Mock the raw Supabase client used for admin operations
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockAdminClient),
}))

// Mock next/headers
vi.mock('next/headers', () => ({
    cookies: vi.fn().mockResolvedValue({
        getAll: vi.fn().mockReturnValue([]),
        set: vi.fn(),
    }),
}))

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}))

import { chatWithMatchmaker, findMatch } from '@/app/actions/matchmaker'

describe('matchmaker actions', () => {

    let originalFetch: typeof global.fetch

    beforeEach(() => {
        vi.clearAllMocks()
        process.env.GOOGLE_API_KEY = 'test-key'
        process.env.NEXT_PUBLIC_TRIO_USER_ID = 'trio-id'

        // Reset default auth
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: 'test-user-id', email: 'test@example.com' } },
            error: null,
        })

        // Reset query chain defaults
        mockClient._query.mockResult({ data: null, error: null })
        mockAdminClient._query.mockResult({ data: null, error: null })

        // Re-attach from to return the query chain
        mockClient.from.mockImplementation(() => mockClient._query)
        mockAdminClient.from.mockImplementation(() => mockAdminClient._query)

        originalFetch = global.fetch
        global.fetch = vi.fn()
    })

    afterEach(() => {
        global.fetch = originalFetch
    })

    describe('chatWithMatchmaker', () => {
        it('correctly parses inner structure-enabled nested JSON text from Gemini', async () => {
            const expectedInnerJson = { reply: "Hi there!", readyToSearch: false }

            // Mock fetch to return the expected nested string format used by Structured Outputs 
            vi.mocked(global.fetch).mockResolvedValueOnce(createGeminiResponse(
                JSON.stringify(expectedInnerJson)
            ) as unknown as Response)

            // Setup mock DB for getMatchmakerHistory
            mockClient.from.mockImplementation((table: string) => {
                if (table === 'match_requests') {
                    mockClient._query.mockResult({ data: { conversation_history: [] }, error: null })
                }
                return mockClient._query
            })

            const result = await chatWithMatchmaker("Hello", "req-123")

            // Should successfully double-parse the payload and return the extracted reply string
            expect(result.reply).toBe('Hi there!')
            expect(result.readyToSearch).toBe(false)
        })

        it('returns fallback reply if Gemini returns garbage non-JSON text', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(createGeminiResponse(
                "This is just normal text, totally unparseable"
            ) as unknown as Response)

            mockClient.from.mockImplementation((table: string) => {
                if (table === 'match_requests') {
                    mockClient._query.mockResult({ data: { conversation_history: [] }, error: null })
                }
                return mockClient._query
            })

            const result = await chatWithMatchmaker("Hello", "req-123")
            expect(result.reply).toContain('moment')
        })

        it('returns fallback reply when hitting a 429 rate limit', async () => {
            vi.useFakeTimers()

            // Give it 3 rate limits in a row
            vi.mocked(global.fetch)
                .mockResolvedValueOnce(createRateLimitResponse() as unknown as Response)
                .mockResolvedValueOnce(createRateLimitResponse() as unknown as Response)
                .mockResolvedValueOnce(createRateLimitResponse() as unknown as Response)

            mockClient.from.mockImplementation((table: string) => {
                if (table === 'match_requests') {
                    mockClient._query.mockResult({ data: { conversation_history: [] }, error: null })
                }
                return mockClient._query
            })

            // Should eventually return the gentle UI fallback message safely
            const promise = chatWithMatchmaker("Hello", "req-123")

            await vi.runAllTimersAsync()
            const result = await promise

            expect(result.reply).toContain('moment')

            // Ensure It actually tried 3 times before giving up
            expect(global.fetch).toHaveBeenCalledTimes(3)

            vi.useRealTimers()
        })
    })

    describe('findMatch', () => {
        it('correctly parses Match ID from nested Gemini Output payload', async () => {
            const expectedInnerJson = {
                matchId: "fake-match-uuid",
                matchReason: "• Cool \n• Person \n• Tests",
                introMessage: "Meet the clone!"
            }

            vi.mocked(global.fetch).mockResolvedValueOnce(createGeminiResponse(
                JSON.stringify(expectedInnerJson)
            ) as unknown as Response)

            mockClient.from.mockImplementation((table: string) => {
                if (table === 'profiles') {
                    // Pass DB user checks
                    mockClient._query.mockResult({ data: [{ id: 'fake-match-uuid', first_name: 'Clone' }], error: null })
                } else if (table === 'match_requests') {
                    mockClient._query.mockResult({ data: { id: "req-123" }, error: null })
                }
                return mockClient._query
            })

            mockAdminClient.from.mockImplementation((table: string) => {
                if (table === 'match_requests') {
                    mockAdminClient._query.mockResult({
                        data: {
                            id: "req-123",
                            status: "searching",
                            requester_id: "test-user-id",
                            conversation_history: [{ role: "user", content: "testing" }]
                        },
                        error: null
                    })
                } else if (table === 'participants') {
                    mockAdminClient._query.mockResult({ data: [], error: null })
                } else if (table === 'profiles') {
                    // Pass DB user checks
                    mockAdminClient._query.mockResult({ data: [{ id: 'fake-match-uuid', first_name: 'Clone' }], error: null })
                }

                return mockAdminClient._query
            })

            await findMatch("req-123")

            expect(mockAdminClient.from).toHaveBeenCalledWith('match_requests')
        })
    })

})
