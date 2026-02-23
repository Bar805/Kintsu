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
        it('uses 3-stage RAG pipeline: extract → Places API → synthesize', async () => {

            // Stage 1: Gemini extracts search queries
            const searchResponse = {
                queries: ["coffee shop", "climbing gym"],
                locationContext: "Portland, OR"
            }

            // Stage 2: Google Places API returns verified venues
            const placesResponse = {
                places: [{
                    displayName: { text: "Stumptown Coffee Roasters" },
                    formattedAddress: "128 SW 3rd Ave, Portland, OR 97204",
                    googleMapsUri: "https://maps.google.com/?cid=123456",
                    primaryType: "coffee_shop"
                }]
            }

            // Stage 3: Gemini synthesizes the message
            const synthResponse = {
                message: "You two should check out Stumptown Coffee Roasters!"
            }

            vi.mocked(global.fetch)
                // Stage 1: Gemini search extraction
                .mockResolvedValueOnce(createGeminiResponse(
                    JSON.stringify(searchResponse)
                ) as unknown as Response)
                // Stage 2a: Places API call for "coffee shop in Portland, OR"
                .mockResolvedValueOnce({
                    ok: true,
                    json: vi.fn().mockResolvedValue(placesResponse),
                } as unknown as Response)
                // Stage 2b: Places API call for "climbing gym in Portland, OR"
                .mockResolvedValueOnce({
                    ok: true,
                    json: vi.fn().mockResolvedValue({ places: [] }),
                } as unknown as Response)
                // Stage 3: Gemini synthesis
                .mockResolvedValueOnce(createGeminiResponse(
                    JSON.stringify(synthResponse)
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

            // Should use the AI-synthesized message
            expect(result?.message).toBe("You two should check out Stumptown Coffee Roasters!")

            // Should include the verified place with Google Maps URI
            expect(result?.places.length).toBe(1)
            expect(result?.places[0].name).toBe("Stumptown Coffee Roasters")
            expect(result?.places[0].googleMapsUri).toBe("https://maps.google.com/?cid=123456")
            expect(result?.places[0].address).toBe("128 SW 3rd Ave, Portland, OR 97204")

            // Should have called Places API
            expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
                'https://places.googleapis.com/v1/places:searchText',
                expect.objectContaining({ method: 'POST' })
            )

            // Should insert message via admin client
            expect(mockAdminClient.from).toHaveBeenCalledWith('messages')
        })

        it('returns null when Places API finds no venues', async () => {

            // Stage 1: Gemini extracts queries
            vi.mocked(global.fetch)
                .mockResolvedValueOnce(createGeminiResponse(
                    JSON.stringify({ queries: ["underwater basket weaving"], locationContext: "" })
                ) as unknown as Response)
                // Stage 2: Places API returns nothing
                .mockResolvedValueOnce({
                    ok: true,
                    json: vi.fn().mockResolvedValue({ places: [] }),
                } as unknown as Response)

            mockClient.from.mockImplementation((table: string) => {
                if (table === 'messages') {
                    mockClient._query.mockResult({ data: [{ sender_id: 'other', content: 'hi' }], error: null })
                } else if (table === 'participants') {
                    mockClient._query.mockResult({ data: [{ user_id: 'test-user-id' }, { user_id: 'other' }], error: null })
                } else if (table === 'profiles') {
                    mockClient._query.mockResult({ data: [{ id: 'test-user-id', first_name: 'Test', interests: [] }], error: null })
                }
                return mockClient._query
            })

            const result = await generateMeetupSuggestion("conv-123")
            expect(result).toBeNull()
        })
    })
})
