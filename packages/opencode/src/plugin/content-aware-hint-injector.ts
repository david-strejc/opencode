/**
 * Content-Aware Hint Injection System for OpenCode
 * Analyzes prompt content to make intelligent hint injection decisions
 */

import { z } from "zod"
import { Bus } from "../bus"
import { MessageV2 } from "../message/v2"

// Types for prompt analysis
interface PromptAnalysis {
  intent: string
  keywords: string[]
  complexity: "simple" | "moderate" | "complex"
  domains: string[]
  sentiment: "positive" | "neutral" | "negative" | "frustrated"
  shouldInjectHint: boolean
  suggestedHint?: string
  confidence: number
}

interface SessionAnalysisState {
  messageCount: number
  lastAnalysis?: PromptAnalysis
  previousIntents: string[]
  contextHistory: string[]
  hintInjectedAt: number[]
}

// Session state tracking
const sessionStates = new Map<string, SessionAnalysisState>()

// Keyword patterns for different domains
const DOMAIN_PATTERNS = {
  debugging: /\b(error|bug|fix|debug|issue|problem|crash|fail|broken|exception|stack|trace)\b/gi,
  performance: /\b(slow|performance|optimize|speed|fast|efficient|bottleneck|profile|benchmark|latency)\b/gi,
  architecture: /\b(design|architecture|structure|pattern|refactor|organize|modular|scale|maintain)\b/gi,
  security: /\b(security|vulnerability|exploit|injection|xss|csrf|auth|permission|encrypt|hash|token)\b/gi,
  testing: /\b(test|unit|integration|coverage|mock|stub|assert|expect|spec|tdd|bdd)\b/gi,
  deployment: /\b(deploy|production|staging|release|ci|cd|pipeline|docker|kubernetes|aws|cloud)\b/gi,
  database: /\b(database|sql|query|index|migration|schema|orm|transaction|deadlock|optimize)\b/gi,
  api: /\b(api|endpoint|rest|graphql|webhook|request|response|status|header|cors)\b/gi,
  frontend: /\b(ui|ux|css|style|responsive|component|react|vue|angular|dom|render)\b/gi,
  algorithm: /\b(algorithm|complexity|bigO|sort|search|tree|graph|dynamic|recursive|optimize)\b/gi
}

// Intent patterns
const INTENT_PATTERNS = {
  asking_for_help: /\b(help|how|what|why|explain|understand|confused|stuck|don't know)\b/gi,
  implementing: /\b(implement|create|build|make|develop|write|code|add|feature)\b/gi,
  fixing: /\b(fix|solve|repair|correct|resolve|handle|address|patch)\b/gi,
  optimizing: /\b(optimize|improve|enhance|refactor|clean|simplify|better)\b/gi,
  reviewing: /\b(review|check|verify|validate|ensure|confirm|analyze|audit)\b/gi,
  learning: /\b(learn|understand|explain|teach|show|demonstrate|example|tutorial)\b/gi,
  planning: /\b(plan|design|architect|structure|organize|strategy|approach)\b/gi
}

// Contextual hints based on domain and intent
const CONTEXTUAL_HINTS = {
  debugging: {
    asking_for_help: "💡 HINT: Start by isolating the problem. Add console.logs or use a debugger to trace the execution flow. Check the error message carefully - it often contains the solution.",
    implementing: "💡 HINT: When implementing, add proper error handling from the start. Consider what could go wrong and handle those cases gracefully.",
    fixing: "💡 HINT: Before fixing, ensure you understand the root cause. A quick fix might mask a deeper issue. Consider writing a test to prevent regression."
  },
  performance: {
    asking_for_help: "💡 HINT: Use profiling tools to identify actual bottlenecks. Don't optimize prematurely - measure first, then optimize the critical path.",
    implementing: "💡 HINT: Consider performance from the start. Think about data structures, algorithm complexity, and potential scaling issues.",
    optimizing: "💡 HINT: Profile before and after optimization. Focus on the biggest bottlenecks first. Sometimes a different algorithm is better than micro-optimizations."
  },
  architecture: {
    planning: "💡 HINT: Consider SOLID principles and design patterns. Think about maintainability, testability, and how the system will evolve over time.",
    implementing: "💡 HINT: Keep components loosely coupled and highly cohesive. Use dependency injection and interfaces to make the code testable.",
    reviewing: "💡 HINT: Check for code smells, circular dependencies, and violations of single responsibility. Consider if the architecture will scale."
  },
  security: {
    implementing: "💡 HINT: Never trust user input. Always validate, sanitize, and use parameterized queries. Consider the OWASP Top 10 vulnerabilities.",
    fixing: "💡 HINT: Security fixes need thorough testing. Consider edge cases and attempt to exploit the fix yourself. Get a security review if possible.",
    reviewing: "💡 HINT: Look for hardcoded secrets, SQL injection points, XSS vulnerabilities, and authentication bypasses. Check dependency versions for known CVEs."
  },
  testing: {
    implementing: "💡 HINT: Write tests that are independent, repeatable, and fast. Test behavior, not implementation. Consider edge cases and error conditions.",
    asking_for_help: "💡 HINT: Good tests have clear names, test one thing, and have obvious assertions. Use the AAA pattern: Arrange, Act, Assert.",
    fixing: "💡 HINT: A failing test is a gift - it caught a bug! Make sure you understand why it's failing before changing it. The test might be correct."
  }
}

// Fallback hints for general situations
const GENERAL_HINTS = [
  "💡 HINT: Break down complex problems into smaller, manageable pieces. Solve one piece at a time.",
  "💡 HINT: Consider if there's existing code or a library that already solves this problem.",
  "💡 HINT: Think about edge cases and error handling. What happens with null, empty, or invalid inputs?",
  "💡 HINT: Keep it simple. The best solution is often the simplest one that works.",
  "💡 HINT: Document your assumptions and decisions. Your future self will thank you.",
  "💡 HINT: Consider the maintenance burden. Will someone else (or future you) understand this code?",
  "💡 HINT: Test your assumptions. What you think is happening might not be what's actually happening.",
  "💡 HINT: Take a step back. Sometimes a different approach is better than optimizing the current one."
]

/**
 * Analyze prompt content to understand intent and context
 */
function analyzePromptContent(promptText: string, sessionID: string): PromptAnalysis {
  const analysis: PromptAnalysis = {
    intent: "general",
    keywords: [],
    complexity: "simple",
    domains: [],
    sentiment: "neutral",
    shouldInjectHint: false,
    confidence: 0
  }
  
  // Extract keywords (words longer than 3 chars, excluding common words)
  const commonWords = new Set(["the", "and", "for", "with", "this", "that", "from", "have", "will", "can", "should"])
  const words = promptText.toLowerCase().match(/\b\w{4,}\b/g) || []
  analysis.keywords = words.filter(w => !commonWords.has(w))
  
  // Detect domains
  for (const [domain, pattern] of Object.entries(DOMAIN_PATTERNS)) {
    if (pattern.test(promptText)) {
      analysis.domains.push(domain)
    }
  }
  
  // Detect primary intent
  let maxMatches = 0
  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    const matches = (promptText.match(pattern) || []).length
    if (matches > maxMatches) {
      maxMatches = matches
      analysis.intent = intent
    }
  }
  
  // Assess complexity based on prompt length and structure
  const sentences = promptText.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const codeBlocks = (promptText.match(/```/g) || []).length / 2
  const lineCount = promptText.split('\n').length
  
  if (lineCount > 20 || sentences.length > 5 || codeBlocks > 1) {
    analysis.complexity = "complex"
  } else if (lineCount > 10 || sentences.length > 2) {
    analysis.complexity = "moderate"
  }
  
  // Detect sentiment/frustration
  const frustrationWords = /\b(stuck|confused|frustrated|annoying|stupid|doesn't work|broken|why|wtf|damn|hell)\b/gi
  const positiveWords = /\b(great|awesome|perfect|excellent|good|thanks|works|solved)\b/gi
  
  const frustrationCount = (promptText.match(frustrationWords) || []).length
  const positiveCount = (promptText.match(positiveWords) || []).length
  
  if (frustrationCount > 2) {
    analysis.sentiment = "frustrated"
  } else if (positiveCount > frustrationCount) {
    analysis.sentiment = "positive"
  } else if (frustrationCount > 0) {
    analysis.sentiment = "negative"
  }
  
  // Determine if we should inject a hint
  const state = sessionStates.get(sessionID) || { 
    messageCount: 0, 
    previousIntents: [],
    contextHistory: [],
    hintInjectedAt: []
  }
  
  // Decision logic for hint injection
  analysis.shouldInjectHint = shouldInjectHintBasedOnAnalysis(analysis, state)
  
  // Calculate confidence (0-1)
  analysis.confidence = calculateConfidence(analysis)
  
  // Get suggested hint if we should inject
  if (analysis.shouldInjectHint) {
    analysis.suggestedHint = getContextualHint(analysis, state)
  }
  
  return analysis
}

/**
 * Decide if we should inject a hint based on analysis
 */
function shouldInjectHintBasedOnAnalysis(analysis: PromptAnalysis, state: SessionAnalysisState): boolean {
  // Always inject if user is frustrated
  if (analysis.sentiment === "frustrated") {
    return true
  }
  
  // Inject for complex problems
  if (analysis.complexity === "complex" && state.messageCount > 0) {
    return true
  }
  
  // Inject for specific high-value domains
  const criticalDomains = ["security", "performance", "debugging"]
  if (analysis.domains.some(d => criticalDomains.includes(d))) {
    // Don't inject too frequently
    const lastHintMessage = state.hintInjectedAt[state.hintInjectedAt.length - 1] || 0
    if (state.messageCount - lastHintMessage >= 2) {
      return true
    }
  }
  
  // Intent-based injection
  const helpIntents = ["asking_for_help", "fixing", "learning"]
  if (helpIntents.includes(analysis.intent)) {
    // Check if we haven't helped recently
    const lastHintMessage = state.hintInjectedAt[state.hintInjectedAt.length - 1] || 0
    if (state.messageCount - lastHintMessage >= 3) {
      return true
    }
  }
  
  // Pattern detection: Same intent repeated
  if (state.previousIntents.length >= 2) {
    const lastTwo = state.previousIntents.slice(-2)
    if (lastTwo.every(i => i === analysis.intent) && analysis.intent !== "general") {
      return true // User might be stuck
    }
  }
  
  // Default periodic injection (every 5 messages as baseline)
  if (state.messageCount > 0 && state.messageCount % 5 === 0) {
    const lastHintMessage = state.hintInjectedAt[state.hintInjectedAt.length - 1] || 0
    if (state.messageCount - lastHintMessage >= 3) {
      return true
    }
  }
  
  return false
}

/**
 * Calculate confidence score for the analysis
 */
function calculateConfidence(analysis: PromptAnalysis): number {
  let confidence = 0.5 // Base confidence
  
  // Increase confidence based on clear signals
  if (analysis.domains.length > 0) confidence += 0.1 * analysis.domains.length
  if (analysis.intent !== "general") confidence += 0.2
  if (analysis.keywords.length > 5) confidence += 0.1
  if (analysis.sentiment !== "neutral") confidence += 0.1
  
  // Cap at 1.0
  return Math.min(confidence, 1.0)
}

/**
 * Get the most appropriate hint based on context
 */
function getContextualHint(analysis: PromptAnalysis, state: SessionAnalysisState): string {
  // Priority 1: Domain + Intent specific hints
  if (analysis.domains.length > 0 && analysis.intent !== "general") {
    const domain = analysis.domains[0] // Use primary domain
    const domainHints = CONTEXTUAL_HINTS[domain]
    if (domainHints && domainHints[analysis.intent]) {
      return domainHints[analysis.intent]
    }
  }
  
  // Priority 2: Domain-specific general hints
  if (analysis.domains.length > 0) {
    const domain = analysis.domains[0]
    const domainHints = CONTEXTUAL_HINTS[domain]
    if (domainHints) {
      const hints = Object.values(domainHints)
      const index = state.messageCount % hints.length
      return hints[index]
    }
  }
  
  // Priority 3: Sentiment-based hints
  if (analysis.sentiment === "frustrated") {
    return "💡 HINT: Take a step back and break down the problem. Sometimes a fresh perspective or a different approach works better. What's the core issue you're trying to solve?"
  }
  
  // Priority 4: General rotating hints
  const hintIndex = Math.floor(state.messageCount / 3) % GENERAL_HINTS.length
  return GENERAL_HINTS[hintIndex]
}

/**
 * Main plugin export
 */
export default function contentAwareHintInjectorPlugin({ client, app, Bus }) {
  console.log("[ContentAwareHintInjector] Plugin initialized")
  
  return {
    // Analyze message content and decide on hint injection
    async "chat.message"(input: any, output: { message: any; parts: any[] }) {
      try {
        const sessionID = output.message?.sessionID || app.sessionID || "default"
        
        // Extract text content from message parts
        const textParts = output.parts.filter(p => p.type === "text" && p.text)
        const promptText = textParts.map(p => p.text).join("\n")
        
        if (!promptText) return
        
        // Get or create session state
        let state = sessionStates.get(sessionID)
        if (!state) {
          state = {
            messageCount: 0,
            previousIntents: [],
            contextHistory: [],
            hintInjectedAt: []
          }
          sessionStates.set(sessionID, state)
        }
        
        // Increment message count
        state.messageCount++
        
        // Analyze prompt content
        const analysis = analyzePromptContent(promptText, sessionID)
        
        console.log(`[ContentAwareHintInjector] Message #${state.messageCount} Analysis:`, {
          intent: analysis.intent,
          domains: analysis.domains,
          complexity: analysis.complexity,
          sentiment: analysis.sentiment,
          shouldInject: analysis.shouldInjectHint,
          confidence: analysis.confidence.toFixed(2)
        })
        
        // Update state with analysis
        state.lastAnalysis = analysis
        state.previousIntents.push(analysis.intent)
        if (state.previousIntents.length > 5) {
          state.previousIntents.shift() // Keep last 5 intents
        }
        state.contextHistory.push(promptText.substring(0, 100)) // Store snippet
        if (state.contextHistory.length > 10) {
          state.contextHistory.shift()
        }
        
        // Inject hint if analysis suggests it
        if (analysis.shouldInjectHint && analysis.suggestedHint) {
          console.log(`[ContentAwareHintInjector] Injecting hint: ${analysis.suggestedHint}`)
          
          // Add hint to the last text part
          const lastTextPart = textParts[textParts.length - 1]
          if (lastTextPart) {
            lastTextPart.text += `\n\n${analysis.suggestedHint}`
            state.hintInjectedAt.push(state.messageCount)
            
            // Publish event for tracking
            Bus.publish(
              Bus.event("hint.injected", z.object({
                sessionID: z.string(),
                hint: z.string(),
                analysis: z.any(),
                messageNumber: z.number()
              })),
              {
                sessionID,
                hint: analysis.suggestedHint,
                analysis,
                messageNumber: state.messageCount
              }
            )
          }
        }
        
      } catch (error) {
        console.error("[ContentAwareHintInjector] Error:", error)
      }
    },
    
    // Reset session on completion
    async "event"(input: { event: any }) {
      const { type, properties } = input.event || {}
      
      if (type === "session.idle" || type === "session.deleted") {
        const sessionID = properties?.sessionID
        if (sessionID && sessionStates.has(sessionID)) {
          console.log(`[ContentAwareHintInjector] Cleaning up session: ${sessionID}`)
          sessionStates.delete(sessionID)
        }
      }
    }
  }
}

// Export analysis functions for testing and external use
export { analyzePromptContent, shouldInjectHintBasedOnAnalysis, getContextualHint }