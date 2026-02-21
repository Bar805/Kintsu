import { vi } from 'vitest'

/**
 * Creates a mock for the @google/generative-ai module.
 *
 * Usage:
 *   setupGeminiMock({ score: 8, reasoning: 'Great conversation' })
 *   // Now any Gemini API call will return that JSON response
 */
export function setupGeminiMock(responseData: any = { score: 5, reasoning: 'Test response' }) {
    const mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
            text: () => JSON.stringify(responseData),
        },
    })

    const mockModel = {
        generateContent: mockGenerateContent,
    }

    vi.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
            getGenerativeModel: vi.fn().mockReturnValue(mockModel),
        })),
    }))

    return { mockGenerateContent, mockModel }
}
