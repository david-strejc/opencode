/**
 * Built-in Hint Injector for OpenCode
 * Enhances prompts with contextual hints every N messages
 */

import { Bus } from "../bus"
import { MessageV2 } from "../message/v2"
import { Session } from "../session"
import { z } from "zod"

export class HintInjector {
  private static instance: HintInjector
  private messageCounts = new Map<string, number>()
  private readonly INJECT_INTERVAL = 3 // Every 3 messages
  
  // Configurable hints
  private hints = {
    general: [
      "💡 HINT: Consider edge cases and error handling in your approach.",
      "💡 HINT: Think about the performance and scalability of this solution.",
      "💡 HINT: Is there existing code or a library that could simplify this?",
      "💡 HINT: Remember to validate inputs and handle security concerns.",
      "💡 HINT: Could this be broken down into smaller, testable functions?",
    ],
    afterTool: [
      "💡 HINT: Check if the tool output matches your expectations.",
      "💡 HINT: Consider if additional validation or error checking is needed.",
      "💡 HINT: Think about potential side effects of this operation.",
    ],
    debugging: [
      "💡 HINT: Look at the error message carefully - it often points to the solution.",
      "💡 HINT: Check logs and stack traces for more context.",
      "💡 HINT: Try to isolate the problem to a minimal reproducible case.",
    ]
  }
  
  private constructor() {
    this.setupEventListeners()
  }
  
  static getInstance(): HintInjector {
    if (!HintInjector.instance) {
      HintInjector.instance = new HintInjector()
    }
    return HintInjector.instance
  }
  
  private setupEventListeners() {
    // Listen for user messages
    Bus.subscribe(MessageV2.Event.Updated, async (payload) => {
      const message = payload.properties.message
      if (message.role === "user") {
        this.handleUserMessage(message)
      }
    })
    
    // Listen for session events
    Bus.subscribe(Session.Event.Updated, async (payload) => {
      const sessionID = payload.properties.info.id
      if (!this.messageCounts.has(sessionID)) {
        this.messageCounts.set(sessionID, 0)
      }
    })
    
    // Clean up on session end
    Bus.subscribe(Session.Event.Idle, async (payload) => {
      const sessionID = payload.properties.sessionID
      this.messageCounts.delete(sessionID)
    })
  }
  
  private handleUserMessage(message: any) {
    const sessionID = message.sessionID || "default"
    const count = (this.messageCounts.get(sessionID) || 0) + 1
    this.messageCounts.set(sessionID, count)
    
    // Check if we should inject a hint
    if (count % this.INJECT_INTERVAL === 0) {
      this.injectHint(sessionID, count)
    }
  }
  
  private injectHint(sessionID: string, messageCount: number) {
    const hintType = this.detectHintType(sessionID)
    const hints = this.hints[hintType] || this.hints.general
    const hintIndex = Math.floor(messageCount / this.INJECT_INTERVAL - 1) % hints.length
    const hint = hints[hintIndex]
    
    console.log(`[HintInjector] Injecting hint for session ${sessionID} at message #${messageCount}: ${hint}`)
    
    // Publish hint event that other components can listen to
    Bus.publish(
      Bus.event("hint.injected", z.object({
        sessionID: z.string(),
        hint: z.string(),
        messageCount: z.number()
      })),
      { sessionID, hint, messageCount }
    )
  }
  
  private detectHintType(sessionID: string): keyof typeof this.hints {
    // You can implement context detection logic here
    // For now, return general hints
    return "general"
  }
  
  // Public method to get hint for external use
  public getNextHint(sessionID: string): string | null {
    const count = this.messageCounts.get(sessionID) || 0
    if ((count + 1) % this.INJECT_INTERVAL === 0) {
      const hints = this.hints.general
      const hintIndex = Math.floor(count / this.INJECT_INTERVAL) % hints.length
      return hints[hintIndex]
    }
    return null
  }
  
  // Method to manually inject hint into prompt
  public enhancePrompt(prompt: string, sessionID: string): string {
    const count = this.messageCounts.get(sessionID) || 0
    
    if (count > 0 && count % this.INJECT_INTERVAL === 0) {
      const hints = this.hints.general
      const hintIndex = Math.floor(count / this.INJECT_INTERVAL - 1) % hints.length
      const hint = hints[hintIndex]
      
      // Append hint to prompt
      return `${prompt}\n\n${hint}`
    }
    
    return prompt
  }
  
  // Configuration methods
  public setInjectionInterval(interval: number) {
    (this as any).INJECT_INTERVAL = interval
  }
  
  public addCustomHints(category: string, hints: string[]) {
    this.hints[category] = hints
  }
  
  public resetSessionCount(sessionID: string) {
    this.messageCounts.set(sessionID, 0)
  }
}

// Export singleton instance
export const hintInjector = HintInjector.getInstance()