/**
 * Cognitive Workflow Configuration
 *
 * Centralized hyperparameters for Trio's 8-phase cognitive workflow.
 * Tune these based on observed metrics and user feedback.
 */

export const COGNITIVE_CONFIG = {
  // ============================================================================
  // PHASE 1: TRIGGERING
  // ============================================================================

  /**
   * Whether to enable the new cognitive workflow.
   * Set to false to fall back to old 2-phase system entirely.
   */
  ENABLED: true,

  // ============================================================================
  // PHASE 2: SALIENCY
  // ============================================================================

  /**
   * Decay factor for interest saliency (0.0-1.0)
   * Higher = interests stay relevant longer
   * Lower = interests decay faster based on recent messages
   *
   * Recommended range: 0.95-0.99
   * Default: 0.99 (slow decay - interests are stable traits)
   */
  INTEREST_DECAY: 0.99,

  /**
   * Decay factor for message memory saliency (0.0-1.0)
   * Higher = old messages stay relevant longer
   * Lower = conversation context shifts faster
   *
   * Recommended range: 0.90-0.97
   * Default: 0.95 (faster decay - ephemeral context)
   */
  MESSAGE_DECAY: 0.95,

  // ============================================================================
  // PHASE 3: MEMORY
  // ============================================================================

  /**
   * Size of rolling message memory window
   * Higher = more context but slower/more expensive
   * Lower = less context but faster
   *
   * Recommended range: 5-15
   * Default: 10
   */
  MEMORY_WINDOW_SIZE: 10,

  // ============================================================================
  // PHASE 4: THOUGHT GENERATION
  // ============================================================================

  /**
   * Number of System 1 thoughts to generate
   * Recommended: 1 (single quick reaction)
   */
  SYSTEM1_COUNT: 1,

  /**
   * Number of System 2 thoughts to generate
   * Higher = more diverse thoughts but more API calls
   * Lower = faster but less diverse
   *
   * Recommended range: 1-3
   * Default: 2
   */
  SYSTEM2_COUNT: 2,

  /**
   * Context window for System 1 (number of recent messages)
   * Lower = faster, more reactive
   * Higher = more context but slower
   *
   * Recommended range: 2-5
   * Default: 3
   */
  SYSTEM1_CONTEXT_MESSAGES: 3,

  /**
   * Context window for System 2 (number of recent messages)
   * Higher = better context for deliberate thoughts
   * Lower = faster processing
   *
   * Recommended range: 3-8
   * Default: 5
   */
  SYSTEM2_CONTEXT_MESSAGES: 5,

  /**
   * Top-K salient interests to retrieve for System 2
   * Higher = more interest context but slower
   * Lower = faster but may miss relevant interests
   *
   * Recommended range: 3-8
   * Default: 5
   */
  SYSTEM2_TOP_INTERESTS: 5,

  /**
   * Top-K salient previous thoughts to retrieve for System 2
   * Higher = better continuity but more context
   * Lower = faster, more independent thoughts
   *
   * Recommended range: 2-5
   * Default: 3
   */
  SYSTEM2_TOP_THOUGHTS: 3,

  /**
   * Temperature for System 1 generation (0.0-2.0)
   * Higher = more creative/random
   * Lower = more deterministic
   *
   * Recommended range: 0.7-1.0
   * Default: 0.8 (high spontaneity)
   */
  SYSTEM1_TEMPERATURE: 0.8,

  /**
   * Temperature for System 2 generation (0.0-2.0)
   * Higher = more creative
   * Lower = more consistent
   *
   * Recommended range: 0.4-0.7
   * Default: 0.5 (balanced)
   */
  SYSTEM2_TEMPERATURE: 0.5,

  // ============================================================================
  // PHASE 5: EVALUATION
  // ============================================================================

  /**
   * Temperature for thought evaluation (0.0-1.0)
   * Lower = more consistent scoring
   * Higher = more variation in scores
   *
   * Recommended range: 0.05-0.2
   * Default: 0.1 (low - consistent scoring)
   */
  EVALUATION_TEMPERATURE: 0.1,

  /**
   * Balance penalty multiplier when Trio spoke recently
   * Applied if Trio spoke < RECENT_SPEECH_THRESHOLD messages ago
   *
   * Range: 0.0-1.0 (0.7 = 30% penalty)
   * Default: 0.7
   */
  BALANCE_PENALTY_MULTIPLIER: 0.7,

  /**
   * Message threshold for "recent speech" penalty
   * If Trio spoke within this many messages, apply penalty
   *
   * Recommended range: 2-5
   * Default: 3
   */
  RECENT_SPEECH_THRESHOLD: 3,

  /**
   * Boost multiplier when Trio hasn't spoken in a while
   * Applied if Trio hasn't spoken in > SILENCE_BOOST_THRESHOLD messages
   *
   * Range: 1.0-1.3 (1.1 = 10% boost)
   * Default: 1.1
   */
  SILENCE_BOOST_MULTIPLIER: 1.1,

  /**
   * Message threshold for silence boost
   * If Trio hasn't spoken in this many messages, apply boost
   *
   * Recommended range: 8-15
   * Default: 10
   */
  SILENCE_BOOST_THRESHOLD: 10,

  // ============================================================================
  // PHASE 6: SELECTION
  // ============================================================================

  /**
   * Minimum motivation score required for thought to be articulated (1.0-5.0)
   *
   * Higher = Trio speaks less often (more selective)
   * Lower = Trio speaks more often (less selective)
   *
   * Recommended range: 3.0-4.0
   * Default: 3.5 (70% motivation = speaks)
   *
   * Guidelines:
   * - 3.0 = Trio speaks ~15-20% of messages (chatty)
   * - 3.5 = Trio speaks ~5-10% of messages (balanced)
   * - 4.0 = Trio speaks ~2-5% of messages (selective)
   * - 4.5 = Trio speaks <2% of messages (rare)
   */
  SELECTION_THRESHOLD: 4,

  // ============================================================================
  // PHASE 7: ARTICULATION
  // ============================================================================

  /**
   * Temperature for message articulation (0.0-2.0)
   * Higher = more varied phrasing
   * Lower = more consistent style
   *
   * Recommended range: 0.6-0.9
   * Default: 0.7 (natural variation)
   */
  ARTICULATION_TEMPERATURE: 0.7,

  // ============================================================================
  // BOOTSTRAP
  // ============================================================================

  /**
   * Initial saliency score for interests on bootstrap (0.0-1.0)
   * Default: 0.5 (neutral relevance)
   */
  INITIAL_INTEREST_SALIENCY: 0.5,

  // ============================================================================
  // MONITORING & DEBUGGING
  // ============================================================================

  /**
   * Enable verbose logging for all phases
   */
  VERBOSE_LOGGING: true,

  /**
   * Log thought content and stimuli
   */
  LOG_THOUGHT_DETAILS: true,

  /**
   * Log evaluation reasoning
   */
  LOG_EVALUATION_REASONING: true,
};

/**
 * Experimental A/B testing configurations
 * Use these to test different parameter combinations
 */
export const EXPERIMENTAL_CONFIGS = {
  /**
   * Chatty Trio - speaks more frequently
   */
  CHATTY: {
    ...COGNITIVE_CONFIG,
    SELECTION_THRESHOLD: 3.0,
    BALANCE_PENALTY_MULTIPLIER: 0.8, // Less penalty
    RECENT_SPEECH_THRESHOLD: 2,
  },

  /**
   * Selective Trio - speaks only when very confident
   */
  SELECTIVE: {
    ...COGNITIVE_CONFIG,
    SELECTION_THRESHOLD: 4.0,
    BALANCE_PENALTY_MULTIPLIER: 0.6, // More penalty
    RECENT_SPEECH_THRESHOLD: 5,
  },

  /**
   * Performance mode - faster but less context
   */
  FAST: {
    ...COGNITIVE_CONFIG,
    MEMORY_WINDOW_SIZE: 5,
    SYSTEM2_COUNT: 1,
    SYSTEM2_CONTEXT_MESSAGES: 3,
    SYSTEM2_TOP_INTERESTS: 3,
    SYSTEM2_TOP_THOUGHTS: 2,
  },

  /**
   * High quality mode - more context and thoughts
   */
  QUALITY: {
    ...COGNITIVE_CONFIG,
    MEMORY_WINDOW_SIZE: 15,
    SYSTEM2_COUNT: 3,
    SYSTEM2_CONTEXT_MESSAGES: 8,
    SYSTEM2_TOP_INTERESTS: 8,
    SYSTEM2_TOP_THOUGHTS: 5,
  },
};

/**
 * Get the active configuration
 * Set via environment variable: COGNITIVE_MODE=CHATTY|SELECTIVE|FAST|QUALITY
 */
export function getCognitiveConfig() {
  const mode = process.env.COGNITIVE_MODE as keyof typeof EXPERIMENTAL_CONFIGS;

  if (mode && mode in EXPERIMENTAL_CONFIGS) {
    console.log(`[cognitive-config] Using ${mode} mode`);
    return EXPERIMENTAL_CONFIGS[mode];
  }

  return COGNITIVE_CONFIG;
}
