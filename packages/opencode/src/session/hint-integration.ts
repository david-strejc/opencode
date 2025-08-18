/**
 * Integration point for hint injection into OpenCode sessions
 * This shows how to properly inject hints every N messages
 */

import { Bus } from "../bus"
import { MessageV2 } from "../message/v2"
import { z } from "zod"

// Track message counts and hint state
const sessionState = new Map<string, {
  messageCount: number
  lastHintAt: number
  context: string[]
}>()

// Configuration
const HINT_CONFIG = {
  interval: 3, // Inject every 3 messages
  enabled: true,
  mode: "append" as "append" | "prepend" | "replace"
}

// Hint templates with rotation
const HINT_TEMPLATES = [
  "\n\n💡 HINT: Remember to consider edge cases and validate your assumptions.",
  "\n\n💡 HINT: Think about whether this solution will scale with larger inputs.",
  "\n\n💡 HINT: Consider if there's a simpler or more elegant approach.",
  "\n\n💡 HINT: Don't forget to handle errors gracefully and provide meaningful feedback.",
  "\n\n💡 HINT: Check if similar functionality exists elsewhere in the codebase.",
  "\n\n💡 HINT: Consider the security implications of this implementation.",
  "\n\n💡 HINT: Think about how this code will be tested and maintained.",
  "\n\n💡 HINT: Remember to document complex logic for future developers."
]

/**
 * Initialize hint injection system
 * Call this during OpenCode startup
 */
export function initializeHintInjection() {
  console.log("[HintSystem] Initializing hint injection system")
  
  // Subscribe to message events
  Bus.subscribe(MessageV2.Event.Updated, async (payload) => {
    const message = payload.properties.message
    
    if (message.role === "user") {
      handleUserMessage(message)
    }
  })
  
  // Subscribe to part updates for real-time injection
  Bus.subscribe(MessageV2.Event.PartUpdated, async (payload) => {
    const part = payload.properties.part
    
    if (part.type === "text" && shouldInjectHint(part.sessionID)) {
      // This is where we can modify the part content
      console.log("[HintSystem] Opportunity to inject hint into part")
    }
  })
}

/**
 * Handle user messages and track counts
 */
function handleUserMessage(message: any) {
  const sessionID = message.sessionID || message.id
  
  // Initialize or update session state
  if (!sessionState.has(sessionID)) {
    sessionState.set(sessionID, {
      messageCount: 0,
      lastHintAt: 0,
      context: []
    })
  }
  
  const state = sessionState.get(sessionID)!
  state.messageCount++
  
  console.log(`[HintSystem] Session ${sessionID}: Message #${state.messageCount}`)
  
  // Check if it's time to inject a hint
  if (shouldInjectHint(sessionID)) {
    const hint = getNextHint(sessionID)
    console.log(`[HintSystem] Time to inject hint: ${hint}`)
    state.lastHintAt = state.messageCount
    
    // Emit event for hint injection
    Bus.publish(
      Bus.event("hint.ready", z.object({
        sessionID: z.string(),
        hint: z.string(),
        messageNumber: z.number()
      })),
      {
        sessionID,
        hint,
        messageNumber: state.messageCount
      }
    )
  }
}

/**
 * Check if we should inject a hint
 */
function shouldInjectHint(sessionID: string): boolean {
  if (!HINT_CONFIG.enabled) return false
  
  const state = sessionState.get(sessionID)
  if (!state) return false
  
  // Check if it's time based on interval
  return state.messageCount > 0 && 
         state.messageCount % HINT_CONFIG.interval === 0 &&
         state.lastHintAt !== state.messageCount
}

/**
 * Get the next hint for a session
 */
function getNextHint(sessionID: string): string {
  const state = sessionState.get(sessionID)
  if (!state) return HINT_TEMPLATES[0]
  
  // Calculate which hint to use (rotate through templates)
  const hintIndex = Math.floor(state.messageCount / HINT_CONFIG.interval - 1) % HINT_TEMPLATES.length
  return HINT_TEMPLATES[hintIndex]
}

/**
 * Enhanced prompt with hint injection
 * This is the main integration point - call this when building prompts
 */
export function enhancePromptWithHint(prompt: string, sessionID: string): string {
  if (!HINT_CONFIG.enabled) return prompt
  
  const state = sessionState.get(sessionID)
  if (!state) {
    // Initialize state if needed
    sessionState.set(sessionID, {
      messageCount: 1,
      lastHintAt: 0,
      context: []
    })
    return prompt
  }
  
  // Increment count
  state.messageCount++
  
  // Check if we should inject hint
  if (state.messageCount % HINT_CONFIG.interval === 0) {
    const hint = getNextHint(sessionID)
    state.lastHintAt = state.messageCount
    
    console.log(`[HintSystem] Enhancing prompt with hint at message #${state.messageCount}`)
    
    // Apply hint based on mode
    switch (HINT_CONFIG.mode) {
      case "append":
        return prompt + hint
      case "prepend":
        return hint + "\n\n" + prompt
      case "replace":
        // For replace mode, you might want to wrap the prompt
        return `${prompt}\n\n${hint}\n\nKeep the above hint in mind while responding.`
      default:
        return prompt + hint
    }
  }
  
  return prompt
}

/**
 * Configuration API
 */
export const HintSystem = {
  // Enable/disable hint injection
  setEnabled(enabled: boolean) {
    HINT_CONFIG.enabled = enabled
    console.log(`[HintSystem] Hints ${enabled ? 'enabled' : 'disabled'}`)
  },
  
  // Set injection interval (every N messages)
  setInterval(interval: number) {
    HINT_CONFIG.interval = Math.max(1, interval)
    console.log(`[HintSystem] Hint interval set to ${HINT_CONFIG.interval}`)
  },
  
  // Set injection mode
  setMode(mode: "append" | "prepend" | "replace") {
    HINT_CONFIG.mode = mode
    console.log(`[HintSystem] Hint mode set to ${mode}`)
  },
  
  // Add custom hints
  addHints(hints: string[]) {
    HINT_TEMPLATES.push(...hints)
    console.log(`[HintSystem] Added ${hints.length} custom hints`)
  },
  
  // Reset session state
  resetSession(sessionID: string) {
    sessionState.delete(sessionID)
    console.log(`[HintSystem] Reset state for session ${sessionID}`)
  },
  
  // Get current state for debugging
  getState(sessionID: string) {
    return sessionState.get(sessionID)
  },
  
  // Manual hint injection
  injectNow(sessionID: string): string {
    const state = sessionState.get(sessionID) || {
      messageCount: 0,
      lastHintAt: 0,
      context: []
    }
    
    // Force hint on next message
    state.messageCount = Math.floor(state.messageCount / HINT_CONFIG.interval) * HINT_CONFIG.interval + HINT_CONFIG.interval - 1
    sessionState.set(sessionID, state)
    
    return getNextHint(sessionID)
  }
}

// Export for use in session processing
export default HintSystem