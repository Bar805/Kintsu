import fs from 'fs/promises'
import path from 'path'

/**
 * Load a prompt template from the prompts/cognitive-workflow directory
 * and substitute variables.
 *
 * @param filename - Name of the prompt file (e.g., 'system1-generation.md')
 * @param variables - Key-value pairs for variable substitution (e.g., { MESSAGES: '...' })
 * @returns The processed prompt with all {{VARIABLE}} placeholders replaced
 */
export async function loadPrompt(
  filename: string,
  variables: Record<string, string> = {}
): Promise<string> {
  try {
    // Read the prompt file
    const promptPath = path.join(process.cwd(), 'prompts', 'cognitive-workflow', filename)
    let promptContent = await fs.readFile(promptPath, 'utf-8')

    // Substitute all {{VARIABLE}} placeholders
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`
      promptContent = promptContent.replaceAll(placeholder, value)
    }

    return promptContent
  } catch (error) {
    console.error(`[prompt-loader] Error loading prompt ${filename}:`, error)
    throw new Error(`Failed to load prompt: ${filename}`)
  }
}

/**
 * Format messages for prompt injection
 * @param messages - Array of message objects
 * @returns Formatted string for prompt
 */
export function formatMessages(messages: Array<{ sender: string; content: string; timestamp?: string }>): string {
  return messages
    .map((msg, idx) => `${idx + 1}. **${msg.sender}**: "${msg.content}"`)
    .join('\n')
}

/**
 * Format user profiles for prompt injection
 * @param profiles - Array of user profile objects
 * @returns Formatted string for prompt
 */
export function formatProfiles(profiles: Array<{ name: string; interests?: string[] }>): string {
  return profiles
    .map((profile, idx) => {
      const interests = profile.interests?.join(', ') || 'None listed'
      return `**User ${idx + 1} (${profile.name})**\n- Interests: ${interests}`
    })
    .join('\n\n')
}

/**
 * Format interests with saliency scores
 * @param interests - Array of interest objects with saliency scores
 * @returns Formatted string for prompt
 */
export function formatInterests(interests: Array<{ interest: string; saliency: number }>): string {
  return interests
    .map((int, idx) => `${idx + 1}. ${int.interest} (saliency: ${int.saliency.toFixed(2)})`)
    .join('\n')
}

/**
 * Format previous thoughts for System 2
 * @param thoughts - Array of thought objects
 * @returns Formatted string for prompt
 */
export function formatThoughts(thoughts: Array<{ category: string; content: string }>): string {
  return thoughts
    .map((thought, idx) => `${idx + 1}. [${thought.category}] ${thought.content}`)
    .join('\n')
}
