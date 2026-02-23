import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryMock, createMockSupabaseClient } from '../mocks/supabase'

// --- vi.hoisted() makes these available inside hoisted vi.mock factories ---
const { mockClient, mockAdminClient } = vi.hoisted(() => {
    // We inline minimal mocks here since the factory helpers aren't available in hoisted scope
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

// Mock the server-side Supabase client
vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn().mockResolvedValue(mockClient),
}))

// Mock the raw Supabase client used for admin operations
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockAdminClient),
}))

// Mock the AI modules
vi.mock('@/app/actions/ai', () => ({
    evaluateConversationState: vi.fn().mockResolvedValue(false),
    generateTrioResponse: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/app/actions/chat-suggestions', () => ({
    generateMeetupSuggestion: vi.fn().mockResolvedValue(null),
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

// --- Now import the module under test ---
import { getMessages, sendMessage } from '@/app/actions/chat'

describe('chat actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()

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
    })

    describe('getMessages', () => {
        it('returns empty array when user is not authenticated', async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({
                data: { user: null },
                error: null,
            })

            const result = await getMessages('conv-1')
            expect(result).toEqual([])
        })

        it('returns empty array when user is not a participant', async () => {
            mockClient.from.mockImplementation(() => {
                mockClient._query.mockResult({ data: null, error: null })
                return mockClient._query
            })

            const result = await getMessages('conv-1')
            expect(result).toEqual([])
            expect(mockClient.from).toHaveBeenCalledWith('participants')
        })

        it('returns messages when user is a valid participant', async () => {
            const testMessages = [
                { id: 'msg-1', conversation_id: 'conv-1', sender_id: 'test-user-id', content: 'Hello!', created_at: '2025-01-01', is_ai_generated: false },
                { id: 'msg-2', conversation_id: 'conv-1', sender_id: 'other-user', content: 'Hi there!', created_at: '2025-01-01', is_ai_generated: false },
            ]

            mockClient.from.mockImplementation((table: string) => {
                if (table === 'participants') {
                    mockClient._query.mockResult({ data: { user_id: 'test-user-id' }, error: null })
                } else if (table === 'messages') {
                    mockClient._query.mockResult({ data: testMessages, error: null })
                }
                return mockClient._query
            })

            const result = await getMessages('conv-1')
            expect(result).toEqual(testMessages)
        })
    })

    describe('sendMessage', () => {
        it('returns false when user is not authenticated', async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({
                data: { user: null },
                error: null,
            })

            const result = await sendMessage('conv-1', 'Hello!')
            expect(result).toBe(false)
        })

        it('returns false when user is not a participant', async () => {
            mockClient.from.mockImplementation(() => {
                mockClient._query.mockResult({ data: null, error: null })
                return mockClient._query
            })

            const result = await sendMessage('conv-1', 'Hello!')
            expect(result).toBe(false)
        })

        it('inserts message and returns true on success', async () => {
            mockClient.from.mockImplementation((table: string) => {
                if (table === 'participants') {
                    mockClient._query.mockResult({ data: { user_id: 'test-user-id' }, error: null })
                } else if (table === 'messages') {
                    mockClient._query.mockResult({ data: null, error: null })
                } else if (table === 'profiles') {
                    mockClient._query.mockResult({ data: [], error: null })
                }
                return mockClient._query
            })

            mockAdminClient.from.mockImplementation((table: string) => {
                if (table === 'conversations') {
                    mockAdminClient._query.mockResult({
                        data: {
                            is_active: true,
                            user_ids_who_messaged: [],
                            last_message_sender_id: 'other-user',
                        },
                        error: null,
                    })
                } else if (table === 'participants') {
                    mockAdminClient._query.mockResult({
                        data: [{ user_id: 'test-user-id' }, { user_id: 'other-user' }],
                        error: null,
                    })
                }
                return mockAdminClient._query
            })

            const result = await sendMessage('conv-1', 'Hello!')

            expect(result).toBe(true)
            expect(mockClient.from).toHaveBeenCalledWith('messages')
        })
    })
})
