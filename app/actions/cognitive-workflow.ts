'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { TRIO_CONFIG } from '@/lib/trio-config'

// ============================================================================
// TYPES
// ============================================================================

export interface UserProfile {
  id: string
  first_name: string
  interests: string[]
  bio: string
}

export type SystemType = 'system1' | 'system2'
export type StimulusType = 'interest' | 'message' | 'previous_thought' | 'profile_bio'

export interface Thought {
  id?: string
  conversation_id: string
  trigger_message_id: string
  system_type: SystemType
  category: string
  content: string
  motivation_score: number
  base_score: number
  evaluation_reasoning: string
  was_selected: boolean
  articulated_message_id?: string | null
}

export interface ThoughtStimulus {
  thought_id: string
  stimulus_type: StimulusType
  stimulus_ref_id: string | null
  stimulus_text: string
  saliency_score: number
}

// ============================================================================
// PHASE 1: THOUGHT TRIGGERING
// ============================================================================

export async function shouldProcessMessage(conversationId: string, messageId: string): Promise<boolean> {
  const supabase = await createClient()

  // Get the message that just arrived
  const { data: message } = await supabase
    .from('messages')
    .select('sender_id, is_ai_generated')
    .eq('id', messageId)
    .single()

  if (!message) return false

  // Condition 1: Message must be from a human user (not Trio)
  if (message.is_ai_generated) {
    console.log('[cognitive] Condition 1 failed: Message is from Trio')
    return false
  }

  // Condition 2: Last message was NOT from Trio
  const { data: lastMsg } = await supabase
    .from('messages')
    .select('is_ai_generated')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (lastMsg?.is_ai_generated) {
    console.log('[cognitive] Condition 2 failed: Trio spoke last')
    return false
  }

  // Condition 3: Conversation must be active
  const { data: conv } = await supabase
    .from('conversations')
    .select('is_active')
    .eq('id', conversationId)
    .single()

  if (!conv?.is_active) {
    console.log('[cognitive] Condition 3 failed: Conversation is archived')
    return false
  }

  console.log('[cognitive] All conditions met, proceeding to Phase 2')
  return true
}

// ============================================================================
// PHASE 2: SALIENCY RECALIBRATION
// ============================================================================

async function computeEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_API_KEY
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      output_dimensionality: 768  // Scale down from default 3072 to match DB schema
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[cognitive] Embedding API Error:', response.status, errorText)
    throw new Error(`Embedding API Error: ${response.status}`)
  }

  const data = await response.json()
  return data.embedding?.values || []
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

export async function updateSaliency(conversationId: string, messageContent: string): Promise<void> {
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  console.log('[cognitive] Phase 2: Computing message embedding')
  const messageEmbedding = await computeEmbedding(messageContent)

  // Update interest saliency (decay = 0.99)
  const { data: interests } = await adminClient
    .from('interest_saliency')
    .select('*')
    .eq('conversation_id', conversationId)

  if (interests && interests.length > 0) {
    console.log(`[cognitive] Phase 2: Updating ${interests.length} interest saliency scores (decay=0.99)`)
    for (const interest of interests) {
      const embedding = interest.embedding as number[]
      const similarity = cosineSimilarity(messageEmbedding, embedding)
      const newScore = (interest.saliency_score * 0.99) + similarity

      await adminClient
        .from('interest_saliency')
        .update({
          saliency_score: newScore,
          last_updated_at: new Date().toISOString()
        })
        .eq('id', interest.id)
    }
  }

  // Update message memory saliency (decay = 0.95)
  const { data: memories } = await adminClient
    .from('message_memory')
    .select('*')
    .eq('conversation_id', conversationId)

  if (memories && memories.length > 0) {
    console.log(`[cognitive] Phase 2: Updating ${memories.length} message memory saliency scores (decay=0.95)`)
    for (const memory of memories) {
      const embedding = memory.embedding as number[]
      const similarity = cosineSimilarity(messageEmbedding, embedding)
      const newScore = (memory.saliency_score * 0.95) + similarity

      await adminClient
        .from('message_memory')
        .update({
          saliency_score: newScore,
          last_updated_at: new Date().toISOString()
        })
        .eq('id', memory.id)
    }
  }

  console.log('[cognitive] Phase 2 complete: Saliency updated')
}

// ============================================================================
// PHASE 3: MEMORY ADDITION
// ============================================================================

async function generateInterpretation(messageContent: string, senderName: string, recentMessages: any[]): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

  const prompt = `
Analyze this message and provide a semantic interpretation extracting deeper meaning:

Message: "${messageContent}"
Sender: ${senderName}

Recent context:
${recentMessages.map(m => `${m.is_ai_generated ? 'Trio' : 'User'}: ${m.content}`).join('\n')}

Extract:
- Emotional tone (enthusiastic, hesitant, awkward, etc.)
- Connection signals (showing interest, asking questions)
- Friction points (confusion, disagreement, topic mismatch)
- Interest mentions (explicit or implicit references to hobbies/activities)

Provide a brief (1-2 sentence) interpretation.
`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  })

  if (!response.ok) throw new Error(`Interpretation API Error: ${response.status}`)

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || messageContent
}

export async function addToMemory(conversationId: string, messageId: string, messageContent: string): Promise<void> {
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get sender info and recent messages for context
  const { data: message } = await adminClient
    .from('messages')
    .select('sender_id')
    .eq('id', messageId)
    .single()

  const { data: profile } = await adminClient
    .from('profiles')
    .select('first_name')
    .eq('id', message?.sender_id)
    .single()

  const { data: recentMessages } = await adminClient
    .from('messages')
    .select('content, is_ai_generated')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(3)

  console.log('[cognitive] Phase 3: Generating interpretation')
  const interpretation = await generateInterpretation(
    messageContent,
    profile?.first_name || 'User',
    recentMessages || []
  )
  console.log(`[cognitive] Interpretation: "${interpretation}"`)

  // Combine content + interpretation for embedding
  const combinedText = `${messageContent} | ${interpretation}`
  const embedding = await computeEmbedding(combinedText)

  // Check rolling window (keep last 10)
  const { data: memoryCount } = await adminClient
    .from('message_memory')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)

  const count = (memoryCount as any)?.length || 0

  if (count >= 10) {
    // Delete oldest
    const { data: oldest } = await adminClient
      .from('message_memory')
      .select('id')
      .eq('conversation_id', conversationId)
      .order('last_updated_at', { ascending: true })
      .limit(1)
      .single()

    if (oldest) {
      await adminClient
        .from('message_memory')
        .delete()
        .eq('id', oldest.id)
    }
  }

  // Insert new memory
  await adminClient
    .from('message_memory')
    .insert({
      conversation_id: conversationId,
      message_id: messageId,
      interpretation,
      saliency_score: 1.0, // Maximally relevant (brand new)
      embedding
    })

  console.log('[cognitive] Phase 3 complete: Added message to memory (saliency=1.0)')
}

// ============================================================================
// PHASE 4: THOUGHT GENERATION (DUAL-PROCESS)
// ============================================================================

async function generateSystem1Thought(conversationId: string, triggerMessageId: string): Promise<Thought> {
  const supabase = await createClient()
  const apiKey = process.env.GOOGLE_API_KEY
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

  // Get last 3 messages only
  const { data: messages } = await supabase
    .from('messages')
    .select('content, is_ai_generated')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(3)

  const prompt = `
You are Trio's System 1 (fast, intuitive reaction). Generate ONE quick thought based on immediate conversation patterns.

Recent messages:
${messages?.reverse().map(m => `${m.is_ai_generated ? 'Trio' : 'User'}: ${m.content}`).join('\n')}

Generate a brief (< 15 words) thought in one of these categories:
- encouragement: Positive reinforcement
- connection: Quick connection opportunity
- friction_reduction: Notice awkward silence

Return JSON: { "category": "encouragement" | "connection" | "friction_reduction", "content": "your thought" }
`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.8
      }
    })
  })

  const data = await response.json()
  const result = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}')

  const thought = {
    conversation_id: conversationId,
    trigger_message_id: triggerMessageId,
    system_type: 'system1' as SystemType,
    category: result.category || 'encouragement',
    content: result.content || 'Quick positive energy',
    motivation_score: 0, // Will be set in Phase 5
    base_score: 0,
    evaluation_reasoning: '',
    was_selected: false
  }

  console.log(`[cognitive] System 1 thought: [${thought.category}] "${thought.content}"`)

  return thought
}

async function generateSystem2Thoughts(conversationId: string, triggerMessageId: string, profiles: UserProfile[]): Promise<{ thoughts: Thought[], stimuli: Map<string, ThoughtStimulus[]> }> {
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const apiKey = process.env.GOOGLE_API_KEY
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

  // Get last 5 messages
  const { data: messages } = await adminClient
    .from('messages')
    .select('id, content, is_ai_generated')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(5)

  // Get top 5 salient interests
  const { data: interests } = await adminClient
    .from('interest_saliency')
    .select('id, interest_text, saliency_score, user_id')
    .eq('conversation_id', conversationId)
    .order('saliency_score', { ascending: false })
    .limit(5)

  // Get top 3 salient previous thoughts
  const { data: prevThoughts } = await adminClient
    .from('trio_thoughts')
    .select('id, content, motivation_score')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(3)

  const prompt = `
You are Trio's System 2 (deliberate, memory-based). Generate TWO diverse thoughts.

USER PROFILES:
${profiles.map(p => `${p.first_name}: ${p.interests.join(', ')} | Bio: ${p.bio}`).join('\n')}

RECENT MESSAGES:
${messages?.reverse().map(m => `${m.is_ai_generated ? 'Trio' : 'User'}: ${m.content}`).join('\n')}

TOP SALIENT INTERESTS:
${interests?.map((i, idx) => `INT#${idx + 1} [${i.saliency_score.toFixed(2)}]: ${i.interest_text}`).join('\n')}

PREVIOUS THOUGHTS:
${prevThoughts?.map((t, idx) => `THOUGHT#${idx + 1}: ${t.content}`).join('\n')}

Generate 2 thoughts in categories: shared_interest, friction_reduction, meetup_nudge, icebreaker
Each thought should cite 2-5 stimuli (e.g., "INT#1", "MSG#3")

Return JSON array: [
  { "category": "...", "content": "...", "stimuli": ["INT#1", "MSG#2"] },
  { "category": "...", "content": "...", "stimuli": ["INT#3"] }
]
`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.5
      }
    })
  })

  const data = await response.json()
  const results = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '[]')

  const thoughts: Thought[] = []
  const stimuliMap = new Map<string, ThoughtStimulus[]>()

  for (const result of results.slice(0, 2)) {
    const thoughtId = crypto.randomUUID()
    const thought = {
      id: thoughtId,
      conversation_id: conversationId,
      trigger_message_id: triggerMessageId,
      system_type: 'system2' as SystemType,
      category: result.category || 'shared_interest',
      content: result.content || 'Connection opportunity',
      motivation_score: 0,
      base_score: 0,
      evaluation_reasoning: '',
      was_selected: false
    }

    console.log(`[cognitive] System 2 thought: [${thought.category}] "${thought.content}"`)

    thoughts.push(thought)

    // Parse stimuli
    const stimuli: ThoughtStimulus[] = []
    for (const ref of result.stimuli || []) {
      const match = ref.match(/(INT|MSG|THOUGHT)#(\d+)/)
      if (!match) continue

      const [, type, num] = match
      const index = parseInt(num) - 1

      if (type === 'INT' && interests && interests[index]) {
        stimuli.push({
          thought_id: thoughtId,
          stimulus_type: 'interest',
          stimulus_ref_id: interests[index].id,
          stimulus_text: interests[index].interest_text,
          saliency_score: interests[index].saliency_score
        })
      } else if (type === 'MSG' && messages && messages[index]) {
        stimuli.push({
          thought_id: thoughtId,
          stimulus_type: 'message',
          stimulus_ref_id: messages[index].id,
          stimulus_text: messages[index].content.substring(0, 100),
          saliency_score: 1.0 // Recent messages have high saliency
        })
      } else if (type === 'THOUGHT' && prevThoughts && prevThoughts[index]) {
        stimuli.push({
          thought_id: thoughtId,
          stimulus_type: 'previous_thought',
          stimulus_ref_id: prevThoughts[index].id,
          stimulus_text: prevThoughts[index].content.substring(0, 100),
          saliency_score: prevThoughts[index].motivation_score / 5.0 // Normalize to 0-1
        })
      }
    }

    if (stimuli.length > 0) {
      console.log(`[cognitive] → Stimuli: ${stimuli.map(s => `${s.stimulus_type}(${s.stimulus_text?.substring(0, 30)}...)`).join(', ')}`)
    }

    stimuliMap.set(thoughtId, stimuli)
  }

  return { thoughts, stimuli: stimuliMap }
}

export async function generateThoughts(conversationId: string, triggerMessageId: string, profiles: UserProfile[]): Promise<{ thoughts: Thought[], stimuli: Map<string, ThoughtStimulus[]> }> {
  console.log('[cognitive] Phase 4: Generating thoughts (System 1 + System 2)')

  // Run in parallel for speed
  const [system1Thought, system2Result] = await Promise.all([
    generateSystem1Thought(conversationId, triggerMessageId),
    generateSystem2Thoughts(conversationId, triggerMessageId, profiles)
  ])

  const allThoughts = [system1Thought, ...system2Result.thoughts]
  console.log(`[cognitive] Phase 4 complete: Generated ${allThoughts.length} thoughts`)
  console.log('[cognitive] Thought categories:', allThoughts.map(t => t.category).join(', '))

  return { thoughts: allThoughts, stimuli: system2Result.stimuli }
}

// ============================================================================
// PHASE 5: THOUGHT EVALUATION
// ============================================================================

async function evaluateThought(thought: Thought, conversationId: string): Promise<{ base_score: number, reasoning: string }> {
  const supabase = await createClient()
  const apiKey = process.env.GOOGLE_API_KEY
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

  // Get last 5 messages for context
  const { data: messages } = await supabase
    .from('messages')
    .select('content, is_ai_generated')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(5)

  // Check how recently Trio spoke
  const { data: trioMessages } = await supabase
    .from('messages')
    .select('created_at')
    .eq('conversation_id', conversationId)
    .eq('is_ai_generated', true)
    .order('created_at', { ascending: false })
    .limit(1)

  const messagesSinceTrioSpoke = trioMessages && trioMessages.length > 0 ? 5 : 999 // Estimate

  const prompt = `
Evaluate this thought on Social Facilitation Motivation (1.0-5.0 scale).

THOUGHT: "${thought.content}"
CATEGORY: ${thought.category}
SYSTEM TYPE: ${thought.system_type}

CONVERSATION CONTEXT:
${messages?.reverse().map(m => `${m.is_ai_generated ? 'Trio' : 'User'}: ${m.content}`).join('\n')}

EVALUATION FACTORS:
1. Connection Relevance (a): Links to both users' profiles/interests?
2. Friction Severity (b): Addresses social awkwardness/silence?
3. Timing Urgency (c): Right moment to speak, or can wait?
4. Conversation Coherence (d): Fits natural flow, or feels forced?
5. Interjection Balance (e): Trio spoke ${messagesSinceTrioSpoke} messages ago

RATING SCALE:
1.0 = Stay silent, conversation fine
2.0 = Minor opportunity, not urgent
3.0 = Could speak or stay quiet
4.0 = Strong opportunity, should speak
5.0 = Critical moment, must intervene

Provide reasoning citing specific factors, then assign score.

Return JSON: { "reasoning": "...", "score": 1.0-5.0 }
`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1 // Low temperature for consistent scoring
      }
    })
  })

  const data = await response.json()
  const result = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}')

  const evaluation = {
    base_score: Math.max(1.0, Math.min(5.0, result.score || 3.0)),
    reasoning: result.reasoning || 'No reasoning provided'
  }

  console.log(`[cognitive] Evaluating [${thought.category}]: score=${evaluation.base_score.toFixed(2)}`)
  console.log(`[cognitive] → Reasoning: ${evaluation.reasoning.substring(0, 150)}${evaluation.reasoning.length > 150 ? '...' : ''}`)

  return evaluation
}

export async function evaluateThoughts(thoughts: Thought[], conversationId: string): Promise<Thought[]> {
  console.log('[cognitive] Phase 5: Evaluating thoughts')

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Check how many messages since Trio last spoke (for balance penalty)
  const { data: messages } = await adminClient
    .from('messages')
    .select('is_ai_generated')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(10)

  let messagesSinceTrioSpoke = 10
  if (messages) {
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].is_ai_generated) {
        messagesSinceTrioSpoke = i
        break
      }
    }
  }

  // Evaluate all thoughts in parallel
  const evaluations = await Promise.all(
    thoughts.map(t => evaluateThought(t, conversationId))
  )

  // Apply balance penalty
  const evaluatedThoughts = thoughts.map((thought, idx) => {
    const { base_score, reasoning } = evaluations[idx]
    let motivation_score = base_score

    // Apply penalty if Trio spoke recently (< 3 messages ago)
    if (messagesSinceTrioSpoke < 3) {
      motivation_score *= 0.7 // 30% penalty
    } else if (messagesSinceTrioSpoke > 10) {
      motivation_score *= 1.1 // 10% boost
    }

    // Clamp to 1.0-5.0
    motivation_score = Math.max(1.0, Math.min(5.0, motivation_score))

    return {
      ...thought,
      base_score,
      motivation_score,
      evaluation_reasoning: reasoning
    }
  })

  const scores = evaluatedThoughts.map(t => ({
    category: t.category,
    type: t.system_type,
    base: t.base_score.toFixed(2),
    final: t.motivation_score.toFixed(2)
  }))
  console.log('[cognitive] Phase 5 complete: Evaluation results:', JSON.stringify(scores, null, 2))

  return evaluatedThoughts
}

// ============================================================================
// PHASE 6: THOUGHT SELECTION
// ============================================================================

export async function selectBestThought(thoughts: Thought[]): Promise<Thought | null> {
  console.log('[cognitive] Phase 6: Selecting best thought')

  // Sort by motivation score (descending)
  const sorted = [...thoughts].sort((a, b) => b.motivation_score - a.motivation_score)

  const best = sorted[0]
  const threshold = 3.5

  if (best.motivation_score >= threshold) {
    console.log(`[cognitive] Phase 6 complete: SELECTED - ${best.category} (${best.system_type}, score=${best.motivation_score.toFixed(2)})`)
    console.log(`[cognitive] Selected thought: "${best.content.substring(0, 100)}..."`)
    return { ...best, was_selected: true }
  }

  console.log(`[cognitive] Phase 6 complete: NO SELECTION - Top score ${best.motivation_score.toFixed(2)} < threshold ${threshold}`)
  console.log(`[cognitive] Best thought was: "${best.content.substring(0, 100)}..." (${best.category})`)
  return null
}

// ============================================================================
// PHASE 7: ARTICULATION
// ============================================================================

export async function articulateThought(thought: Thought, profiles: UserProfile[]): Promise<string> {
  console.log('[cognitive] Phase 7: Articulating thought')

  const supabase = await createClient()
  const apiKey = process.env.GOOGLE_API_KEY
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

  // Get last 5 messages for context
  const { data: messages } = await supabase
    .from('messages')
    .select('content, is_ai_generated')
    .eq('conversation_id', thought.conversation_id)
    .order('created_at', { ascending: false })
    .limit(5)

  const prompt = `
${TRIO_CONFIG.SYSTEM_PROMPT}

USER PROFILES:
${profiles.map(p => `${p.first_name}: ${p.interests.join(', ')} | Bio: ${p.bio}`).join('\n')}

RECENT CONVERSATION:
${messages?.reverse().map(m => `${m.is_ai_generated ? 'Trio' : 'User'}: ${m.content}`).join('\n')}

INTERNAL THOUGHT: "${thought.content}"
CATEGORY: ${thought.category}

Convert this internal thought into a natural Trio message:
- Brief (1-2 sentences max)
- Casual, punchy language
- Specific references to profiles when relevant
- Use emojis sparingly (🔥 for hype, ✨ for connections)
- Never say "as an AI" or "I'm here to help"

Return ONLY the message text (no JSON, no quotes).
`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7 }
    })
  })

  const data = await response.json()
  const messageText = data.candidates?.[0]?.content?.parts?.[0]?.text || thought.content

  console.log('[cognitive] Phase 7 complete: Articulated message')
  console.log(`[cognitive] Trio will say: "${messageText}"`)
  return messageText
}

// ============================================================================
// PHASE 8: RESPONSE EMISSION
// ============================================================================

export async function emitResponse(thought: Thought, messageText: string, stimuli: ThoughtStimulus[]): Promise<boolean> {
  console.log('[cognitive] Phase 8: Emitting response')

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const trioId = process.env.NEXT_PUBLIC_TRIO_USER_ID
  if (!trioId) throw new Error('Missing Trio ID')

  try {
    // Insert thought record
    const { data: savedThought, error: thoughtError } = await adminClient
      .from('trio_thoughts')
      .insert({
        conversation_id: thought.conversation_id,
        trigger_message_id: thought.trigger_message_id,
        system_type: thought.system_type,
        category: thought.category,
        content: thought.content,
        motivation_score: thought.motivation_score,
        base_score: thought.base_score,
        evaluation_reasoning: thought.evaluation_reasoning,
        was_selected: thought.was_selected
      })
      .select()
      .single()

    if (thoughtError || !savedThought) {
      console.error('[cognitive] Failed to save thought:', thoughtError)
      return false
    }

    // Insert stimuli if System 2
    if (thought.system_type === 'system2' && stimuli.length > 0) {
      const stimuliWithThoughtId = stimuli.map(s => ({ ...s, thought_id: savedThought.id }))
      await adminClient
        .from('thought_stimuli')
        .insert(stimuliWithThoughtId)
    }

    // Insert message
    const { data: message, error: messageError } = await adminClient
      .from('messages')
      .insert({
        conversation_id: thought.conversation_id,
        sender_id: trioId,
        content: messageText,
        is_ai_generated: true,
        thought_id: savedThought.id,
        thought_category: thought.category,
        motivation_score: thought.motivation_score
      })
      .select()
      .single()

    if (messageError || !message) {
      console.error('[cognitive] Failed to insert message:', messageError)
      return false
    }

    // Update thought with articulated message ID
    await adminClient
      .from('trio_thoughts')
      .update({ articulated_message_id: message.id })
      .eq('id', savedThought.id)

    console.log('[cognitive] Phase 8 complete: Message emitted successfully')
    console.log(`[cognitive] Message ID: ${message.id} | Thought ID: ${savedThought.id}`)
    console.log(`[cognitive] Stimuli tracked: ${stimuli.length}`)
    return true

  } catch (error) {
    console.error('[cognitive] Phase 8 failed:', error)
    return false
  }
}

// ============================================================================
// BOOTSTRAP: Initialize interest saliency on first message
// ============================================================================

export async function bootstrapInterestSaliency(conversationId: string): Promise<void> {
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Check if already bootstrapped
  const { data: existing } = await adminClient
    .from('interest_saliency')
    .select('id')
    .eq('conversation_id', conversationId)
    .limit(1)

  if (existing && existing.length > 0) {
    console.log('[cognitive] Bootstrap: Already initialized, skipping')
    return
  }

  console.log('[cognitive] Bootstrap: Initializing interest saliency for conversation:', conversationId)

  // Get participants
  const { data: participants } = await adminClient
    .from('participants')
    .select('user_id')
    .eq('conversation_id', conversationId)

  if (!participants) return

  // Get profiles with embeddings
  for (const participant of participants) {
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, interests, interests_embeddings')
      .eq('id', participant.user_id)
      .single()

    if (!profile || !profile.interests) continue

    const interests = Array.isArray(profile.interests) ? profile.interests : []
    const embeddings = Array.isArray(profile.interests_embeddings) ? profile.interests_embeddings : []

    // Create saliency record for each interest
    for (let i = 0; i < interests.length; i++) {
      const interest = interests[i]
      const embedding = embeddings[i] || []

      if (embedding.length === 0) {
        // Generate embedding if missing
        const emb = await computeEmbedding(interest)
        await adminClient
          .from('interest_saliency')
          .insert({
            conversation_id: conversationId,
            user_id: profile.id,
            interest_text: interest,
            saliency_score: 0.5, // Neutral initial score
            embedding: emb
          })
      } else {
        await adminClient
          .from('interest_saliency')
          .insert({
            conversation_id: conversationId,
            user_id: profile.id,
            interest_text: interest,
            saliency_score: 0.5,
            embedding
          })
      }
    }
  }

  console.log('[cognitive] Bootstrap complete: Interest saliency initialized')
}
