/**
 * Hint Injector Plugin for OpenCode
 * Injects custom hints into the conversation every N messages (configurable)
 */

import { z } from "zod"

// Configuration
const INJECT_EVERY_N_MESSAGES = 3 // Inject hint every 3 messages
const HINT_PREFIX = "\n\nHINT: "

// Track message counts per session
const sessionMessageCounts = new Map<string, number>()

// Define different hints based on context or rotate through them
const hints = [
  "Remember to consider edge cases and error handling in your implementation.",
  "Think about the performance implications of your approach.",
  "Consider if there's a simpler solution to this problem.",
  "Don't forget to validate inputs and handle potential security issues.",
  "Consider breaking down complex tasks into smaller, manageable steps.",
  "Remember to check if similar functionality already exists in the codebase.",
  "Think about maintainability and code readability for future developers.",
  "Consider writing tests for critical functionality.",
]

// Get hint based on message count or context
function getHint(messageCount: number, context?: any): string {
  // You can make this smarter based on context
  // For now, rotate through hints
  const hintIndex = Math.floor(messageCount / INJECT_EVERY_N_MESSAGES) % hints.length
  return hints[hintIndex]
}

// Check if we should inject a hint
function shouldInjectHint(sessionID: string): boolean {
  const count = sessionMessageCounts.get(sessionID) || 0
  return count > 0 && count % INJECT_EVERY_N_MESSAGES === 0
}

export default function hintInjectorPlugin({ client, app, Bus }) {
  console.log("[HintInjector] Plugin loaded - will inject hints every", INJECT_EVERY_N_MESSAGES, "messages")
  
  return {
    // Hook into chat messages before they're processed
    async "chat.message"(input: any, output: { message: any; parts: any[] }) {
      try {
        // Extract session ID from the message or context
        const sessionID = output.message?.sessionID || app.sessionID || "default"
        
        // Increment message count for this session
        const currentCount = (sessionMessageCounts.get(sessionID) || 0) + 1
        sessionMessageCounts.set(sessionID, currentCount)
        
        console.log(`[HintInjector] Session ${sessionID}: Message #${currentCount}`)
        
        // Check if we should inject a hint
        if (shouldInjectHint(sessionID)) {
          const hint = getHint(currentCount)
          
          console.log(`[HintInjector] Injecting hint at message #${currentCount}:`, hint)
          
          // Method 1: Append hint to the user's message
          if (output.parts && output.parts.length > 0) {
            const lastPart = output.parts[output.parts.length - 1]
            if (lastPart.type === "text" && lastPart.content) {
              // Append hint to the existing message
              lastPart.content += HINT_PREFIX + hint
              console.log("[HintInjector] Hint appended to message")
            }
          }
          
          // Method 2: Add hint as a separate part (alternative approach)
          // output.parts.push({
          //   type: "text",
          //   content: HINT_PREFIX + hint
          // })
        }
      } catch (error) {
        console.error("[HintInjector] Error:", error)
      }
    },
    
    // Hook into tool execution completion
    async "tool.execute.after"(input: { tool: string; sessionID: string; callID: string }, output: any) {
      const sessionID = input.sessionID
      const count = sessionMessageCounts.get(sessionID) || 0
      
      // You can also inject hints after specific tools
      if (input.tool === "bash" && count % INJECT_EVERY_N_MESSAGES === 2) {
        // Next message will trigger a hint
        console.log(`[HintInjector] Next message will receive a hint (after bash tool)`)
      }
    },
    
    // Listen to all events for more complex logic
    async "event"(input: { event: any }) {
      const { type, properties } = input.event || {}
      
      // Reset counter on new session
      if (type === "session.created") {
        const sessionID = properties?.sessionID
        if (sessionID) {
          sessionMessageCounts.set(sessionID, 0)
          console.log(`[HintInjector] New session started: ${sessionID}`)
        }
      }
      
      // Clean up on session end
      if (type === "session.idle" || type === "session.deleted") {
        const sessionID = properties?.sessionID
        if (sessionID) {
          sessionMessageCounts.delete(sessionID)
          console.log(`[HintInjector] Session ended, cleanup: ${sessionID}`)
        }
      }
      
      // Track message updates for more accurate counting
      if (type === "message.updated") {
        const message = properties?.message
        if (message?.role === "user") {
          // Another place to track user messages
          const sessionID = message.sessionID || "default"
          const count = sessionMessageCounts.get(sessionID) || 0
          
          if (count > 0 && count % INJECT_EVERY_N_MESSAGES === 0) {
            console.log(`[HintInjector] Message ${count} - hint opportunity detected`)
          }
        }
      }
    },
    
    // Modify chat parameters if needed
    async "chat.params"(input: {}, output: { temperature?: number; topP?: number; options: any }) {
      // You could modify model parameters when hints are active
      // For example, slightly increase temperature for more creative responses after hints
      const activeSession = Array.from(sessionMessageCounts.entries())
        .find(([_, count]) => count % INJECT_EVERY_N_MESSAGES === 0)
      
      if (activeSession) {
        console.log("[HintInjector] Adjusting model parameters for hint context")
        // output.temperature = (output.temperature || 0.7) * 1.1 // Slight increase
      }
    }
  }
}

// Advanced hint system with context awareness
class ContextualHintSystem {
  private hints: Map<string, string[]> = new Map()
  
  constructor() {
    // Define contextual hints based on patterns
    this.hints.set("error", [
      "Check the error message carefully - it often contains the solution.",
      "Consider if this error is a symptom of a deeper issue.",
      "Have you checked the logs for more details?",
    ])
    
    this.hints.set("performance", [
      "Profile the code to identify bottlenecks.",
      "Consider caching frequently accessed data.",
      "Check if you're making unnecessary API calls or database queries.",
    ])
    
    this.hints.set("architecture", [
      "Think about separation of concerns.",
      "Consider the SOLID principles.",
      "Would a design pattern help here?",
    ])
    
    this.hints.set("default", hints)
  }
  
  getContextualHint(context: string, messageCount: number): string {
    const contextHints = this.hints.get(context) || this.hints.get("default")!
    const index = Math.floor(messageCount / INJECT_EVERY_N_MESSAGES) % contextHints.length
    return contextHints[index]
  }
  
  detectContext(message: string): string {
    const lowerMessage = message.toLowerCase()
    
    if (lowerMessage.includes("error") || lowerMessage.includes("bug") || lowerMessage.includes("fix")) {
      return "error"
    }
    if (lowerMessage.includes("slow") || lowerMessage.includes("performance") || lowerMessage.includes("optimize")) {
      return "performance"
    }
    if (lowerMessage.includes("design") || lowerMessage.includes("architecture") || lowerMessage.includes("structure")) {
      return "architecture"
    }
    
    return "default"
  }
}

// Export for use in other plugins or modules
export { ContextualHintSystem, getHint, shouldInjectHint }