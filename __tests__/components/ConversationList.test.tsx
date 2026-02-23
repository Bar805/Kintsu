import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationWithDetails } from '@/types/database'

// --- Use vi.hoisted so mock variables are available in hoisted vi.mock factories ---
const { mockPush, mockRefresh, mockSignOut, mockRemoveChannel, mockSubscribe } = vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockRefresh: vi.fn(),
    mockSignOut: vi.fn().mockResolvedValue({ error: null }),
    mockRemoveChannel: vi.fn(),
    mockSubscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
    useSearchParams: () => new URLSearchParams(),
}))

// Mock Supabase browser client
vi.mock('@/utils/supabase/client', () => ({
    createClient: () => ({
        auth: { signOut: mockSignOut },
        channel: vi.fn().mockReturnValue({
            on: vi.fn().mockReturnThis(),
            subscribe: mockSubscribe,
        }),
        removeChannel: mockRemoveChannel,
    }),
}))

// --- Import component after mocks ---
import ConversationList from '@/components/ConversationList'

// --- Test data ---
const mockConversations: ConversationWithDetails[] = [
    {
        id: 'conv-1',
        created_at: '2025-06-01T00:00:00Z',
        is_active: true,
        timer_expires_at: null,
        last_message_sender_id: null,
        interested_user_ids: [],
        meetup_suggested: false,
        meetup_trigger_after: null,
        partner_name: 'Alice',
        partner_avatar: '',
    },
    {
        id: 'conv-2',
        created_at: '2025-06-02T00:00:00Z',
        is_active: true,
        timer_expires_at: null,
        last_message_sender_id: null,
        interested_user_ids: [],
        meetup_suggested: false,
        meetup_trigger_after: null,
        partner_name: 'Bob',
        partner_avatar: '',
    },
]

describe('ConversationList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders conversation partner names', () => {
        render(
            <ConversationList
                initialConversations={mockConversations}
                currentUserId="test-user-id"
            />
        )

        expect(screen.getByText('Alice')).toBeInTheDocument()
        expect(screen.getByText('Bob')).toBeInTheDocument()
    })

    it('renders partner initials as avatar fallback', () => {
        render(
            <ConversationList
                initialConversations={mockConversations}
                currentUserId="test-user-id"
            />
        )

        expect(screen.getByText('A')).toBeInTheDocument()
        expect(screen.getByText('B')).toBeInTheDocument()
    })

    it('shows empty state when there are no conversations', () => {
        render(
            <ConversationList
                initialConversations={[]}
                currentUserId="test-user-id"
            />
        )

        expect(screen.getByText('Your matches will appear here.')).toBeInTheDocument()
    })

    it('renders conversation links with correct hrefs', () => {
        render(
            <ConversationList
                initialConversations={mockConversations}
                currentUserId="test-user-id"
            />
        )

        const links = screen.getAllByRole('link')
        expect(links[0]).toHaveAttribute('href', '/dashboard?conversationId=conv-1')
        expect(links[1]).toHaveAttribute('href', '/dashboard?conversationId=conv-2')
    })

    it('subscribes to real-time updates on mount', () => {
        render(
            <ConversationList
                initialConversations={mockConversations}
                currentUserId="test-user-id"
            />
        )

        expect(mockSubscribe).toHaveBeenCalled()
    })
})
