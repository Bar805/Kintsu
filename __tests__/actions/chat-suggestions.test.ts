import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createQueryMock, createMockSupabaseClient } from '../mocks/supabase'

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

vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn().mockResolvedValue(mockClient),
}))
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockAdminClient),
}))
vi.mock('next/headers', () => ({
    cookies: vi.fn().mockResolvedValue({
        getAll: vi.fn().mockReturnValue([]),
        set: vi.fn(),
    }),
}))
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}))

import { generateMeetupSuggestion } from '@/app/actions/chat-suggestions'

describe('chat suggestions actions', () => {

    let originalFetch: typeof global.fetch

    beforeEach(() => {
        vi.clearAllMocks()
        process.env.GOOGLE_API_KEY = 'test-key'
        process.env.NEXT_PUBLIC_TRIO_USER_ID = 'trio-id'

        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: 'test-user-id', email: 'test@example.com' } },
            error: null,
        })
        mockClient._query.mockResult({ data: null, error: null })
        mockAdminClient._query.mockResult({ data: null, error: null })

        mockClient.from.mockImplementation(() => mockClient._query)
        mockAdminClient.from.mockImplementation(() => mockAdminClient._query)

        originalFetch = global.fetch
        global.fetch = vi.fn()
    })

    afterEach(() => {
        global.fetch = originalFetch
    })

    describe('generateMeetupSuggestion', () => {
        it('correctly constructs and inserts meetup array card JSON', async () => {

            const expectedInnerJson = {
                message: "You should meet here!",
                places: [
                    { name: "Coffee Place", category: "Coffee", mapsQuery: "Coffee Portland" },
                    { name: "Climbing Place", category: "Activity", mapsQuery: "Climbing Portland" }
                ]
            }

            vi.mocked(global.fetch).mockResolvedValueOnce(createGeminiResponse(
                JSON.stringify(expectedInnerJson)
            ) as unknown as Response)

            mockClient.from.mockImplementation((table: string) => {
                if (table === 'messages') {
                    mockClient._query.mockResult({
                        data: [{ sender_id: 'other', content: 'hello' }], error: null
                    })
                } else if (table === 'participants') {
                    mockClient._query.mockResult({
                        data: [{ user_id: 'test-user-id' }, { user_id: 'other' }], error: null
                    })
                } else if (table === 'profiles') {
                    mockClient._query.mockResult({
                        data: [
                            { id: 'test-user-id', first_name: 'Test', interests: [] },
                            { id: 'other', first_name: 'Other', interests: [] }
                        ],
                        error: null
                    })
                }
                return mockClient._query
            })

            mockAdminClient.from.mockImplementation((table: string) => {
                if (table === 'conversations' || table === 'messages') {
                    mockAdminClient._query.mockResult({ data: null, error: null })
                }
                return mockAdminClient._query
            })

            const result = await generateMeetupSuggestion("conv-123")

            // Should properly parse out the array of arrays structure
            expect(result?.message).toBe("You should meet here!")
            expect(result?.places.length).toBe(2)
            expect(result?.places[0].name).toBe("Coffee Place")

            // Should insert a formatted card message via the admin client
            expect(mockAdminClient.from).toHaveBeenCalledWith('messages')
        })
    })
})
