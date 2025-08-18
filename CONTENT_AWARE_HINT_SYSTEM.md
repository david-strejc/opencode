# Content-Aware Hint Injection System for OpenCode

## Overview

A sophisticated hint injection system that analyzes prompt content in real-time to provide intelligent, contextual hints based on user needs, problem complexity, and detected patterns.

## Key Features

### 1. Content Analysis Engine
The system extracts and analyzes prompt text to understand:

- **Intent Detection**: 
  - `asking_for_help` - User needs guidance
  - `implementing` - Building new features
  - `fixing` - Debugging or solving issues
  - `optimizing` - Improving performance
  - `reviewing` - Code review requests
  - `learning` - Educational queries
  - `planning` - Architecture and design

- **Domain Recognition**:
  - `debugging` - Error handling and bug fixes
  - `performance` - Optimization and speed
  - `security` - Authentication and vulnerabilities
  - `testing` - Unit tests and coverage
  - `architecture` - Design patterns and structure
  - `database` - SQL and data management
  - `frontend` - UI/UX and styling
  - `api` - Endpoints and integrations

- **Sentiment Analysis**:
  - `frustrated` - User showing signs of frustration
  - `positive` - Successful or happy context
  - `neutral` - Standard technical discussion
  - `negative` - Problems without frustration

- **Complexity Assessment**:
  - `simple` - Basic queries or short prompts
  - `moderate` - Standard development tasks
  - `complex` - Multi-faceted problems requiring deep analysis

### 2. Smart Decision Engine

The system decides when to inject hints based on multiple factors:

```javascript
Decision Logic:
├── Frustration Detected → Always inject supportive hint
├── Complex Problem → Inject guidance for breaking down
├── Security/Performance Issue → Inject critical domain hint
├── Question Pattern → Inject every 2nd question
├── Stuck Pattern → Detect repeated intent, inject help
└── Default → Inject every 4-5 messages if no triggers
```

### 3. Contextual Hint Library

Domain and intent-specific hints provide targeted guidance:

#### Debugging Hints
```
💡 HINT: Check the error message carefully - it often contains the exact solution.
💡 HINT: Add console.logs before and after the problematic code.
💡 HINT: Try to reproduce the issue with minimal code.
```

#### Performance Hints
```
💡 HINT: Profile first, optimize second. Use DevTools to identify bottlenecks.
💡 HINT: Consider algorithmic complexity over micro-optimizations.
💡 HINT: Check for unnecessary loops or inefficient data structures.
```

#### Security Hints
```
💡 HINT: Never trust user input. Always validate and sanitize.
💡 HINT: Check the OWASP Top 10 for common vulnerabilities.
💡 HINT: Don't store sensitive data in plain text.
```

## Implementation

### Plugin Installation

1. **Create the plugin file**:
```bash
mkdir -p ~/.opencode/plugin
cp smart-hints.js ~/.opencode/plugin/
```

2. **Plugin Structure** (`~/.opencode/plugin/smart-hints.js`):
```javascript
module.exports = function({ client, app }) {
  return {
    async "chat.message"(input, output) {
      // Extract text from message parts
      const text = extractPromptText(output.parts)
      
      // Analyze content
      const analysis = analyzePrompt(text)
      
      // Decide if hint needed
      if (shouldInjectHint(analysis, sessionState)) {
        const hint = getSmartHint(analysis)
        injectHint(output.parts, hint)
      }
    }
  }
}
```

### Core Integration

For deeper integration into OpenCode core:

1. **Modify Session Handler** (`/packages/opencode/src/session/index.ts`):
```typescript
// Line ~617, before Plugin.trigger
import { enhancePromptWithHint } from "./hint-integration"

for (const part of userParts) {
  if (part.type === "text") {
    part.content = enhancePromptWithHint(part.content, sessionID)
  }
}
```

2. **Add Content Analysis Module** (`/packages/opencode/src/session/content-analyzer.ts`):
```typescript
export function analyzePromptContent(text: string): PromptAnalysis {
  return {
    intent: detectIntent(text),
    domains: detectDomains(text),
    sentiment: analyzeSentiment(text),
    complexity: assessComplexity(text),
    shouldInjectHint: evaluateNeedForHint()
  }
}
```

## Usage Examples

### Example 1: Debugging Context
```
User: "I'm getting an undefined error in my code"

Analysis:
- Domain: debugging
- Intent: fixing
- Keywords: ["error", "undefined"]
- Sentiment: negative

Injected Hint:
"💡 HINT: Check the error message carefully - it often contains 
the exact solution. Look at the line number and stack trace."
```

### Example 2: Frustrated User
```
User: "This is so frustrating! Nothing works and I'm stuck!"

Analysis:
- Sentiment: frustrated
- Intent: asking_for_help
- Keywords: ["frustrated", "stuck", "nothing works"]

Injected Hint:
"💡 HINT: Take a deep breath. Let's break this down step by step. 
What's the specific issue you're facing?"
```

### Example 3: Performance Question
```
User: "My application is running very slow, how can I optimize it?"

Analysis:
- Domain: performance
- Intent: optimizing
- Keywords: ["slow", "optimize"]
- Complexity: moderate

Injected Hint:
"💡 HINT: Profile first, optimize second. Use browser DevTools 
to identify actual bottlenecks."
```

### Example 4: Complex Architecture
```
User: [Long prompt about distributed systems, caching, etc.]

Analysis:
- Domains: ["architecture", "performance", "database"]
- Complexity: complex
- Intent: implementing

Injected Hint:
"💡 HINT: Break down complex problems into smaller pieces. 
Consider SOLID principles and design patterns."
```

## Configuration

### Environment Variables
```bash
# Control hint injection behavior
export OPENCODE_HINTS_ENABLED=true
export OPENCODE_HINTS_MIN_INTERVAL=2    # Min messages between hints
export OPENCODE_HINTS_COMPLEXITY_THRESHOLD=moderate
```

### Runtime Configuration
```javascript
// In plugin or config
HintSystem.configure({
  enabled: true,
  minInterval: 2,
  domains: ['debugging', 'security'],  // Focus areas
  frustrationSupport: true,
  customHints: [/* your hints */]
})
```

## Testing

### Test Script (`test-smart-hints.sh`)
```bash
#!/bin/bash

# Test different scenarios
SESSION_ID="test-$(date +%s)"

# Simple question - no hint
opencode run "What is 2+2?" --session $SESSION_ID

# Debugging context - HINT EXPECTED
opencode run "undefined error in my code" --session $SESSION_ID

# Performance issue - HINT EXPECTED
opencode run "application running slow" --session $SESSION_ID

# Frustrated user - HINT EXPECTED
opencode run "This is frustrating! Stuck!" --session $SESSION_ID
```

### Expected Behavior

| Message # | Content Type | Hint Injected | Reason |
|-----------|-------------|---------------|---------|
| 1 | Simple math | No | No triggers |
| 2 | Debug error | Yes | Debugging domain detected |
| 3 | Normal code | No | Recent hint, no triggers |
| 4 | Performance | Yes | Performance domain + interval |
| 5 | Frustration | Yes | Always help frustrated users |

## Advanced Features

### Pattern Detection
```javascript
// Detect if user is stuck (repeated similar intents)
if (lastThreeIntents.every(i => i === 'fixing')) {
  return "💡 HINT: Seems like you're stuck. Try a different approach."
}
```

### Context Accumulation
```javascript
// Build context over conversation
sessionContext.add({
  message: currentMessage,
  domains: detectedDomains,
  timestamp: Date.now()
})

// Use accumulated context for better hints
if (sessionContext.hasPattern('error-fix-error')) {
  return "💡 HINT: The fix might be creating new issues. Review changes."
}
```

### Multi-Modal Analysis
```javascript
// Analyze code blocks separately
const codeBlocks = extractCodeBlocks(prompt)
const codeAnalysis = analyzeCode(codeBlocks)

if (codeAnalysis.hasSecurityIssue) {
  injectSecurityHint()
}
```

## API Reference

### Core Functions

#### `analyzePromptContent(text: string): PromptAnalysis`
Analyzes prompt text and returns comprehensive analysis.

#### `shouldInjectHint(analysis: PromptAnalysis, state: SessionState): boolean`
Decides whether to inject a hint based on analysis and session state.

#### `getSmartHint(analysis: PromptAnalysis): string`
Returns the most appropriate hint for the current context.

#### `injectHint(parts: MessagePart[], hint: string): void`
Injects hint into message parts.

### Types

```typescript
interface PromptAnalysis {
  intent: string
  keywords: string[]
  domains: string[]
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated'
  complexity: 'simple' | 'moderate' | 'complex'
  shouldInjectHint: boolean
  suggestedHint?: string
  confidence: number
}

interface SessionState {
  messageCount: number
  lastHintAt: number
  previousIntents: string[]
  contextHistory: string[]
}
```

## Benefits

1. **Improved User Experience**: Provides help exactly when needed
2. **Reduced Frustration**: Detects and addresses user frustration
3. **Contextual Guidance**: Domain-specific hints for better solutions
4. **Learning Reinforcement**: Reminds about best practices
5. **Adaptive Support**: Adjusts to user patterns and needs
6. **Anti-Spam Logic**: Doesn't overwhelm with too many hints

## Troubleshooting

### Hints Not Appearing
- Check plugin is loaded: Look for `[SmartHints]` in logs
- Verify session continuity: Use `--session` flag
- Check analysis triggers in console output

### Wrong Hint Selection
- Review domain detection patterns
- Check intent classification logic
- Verify sentiment analysis thresholds

### Too Many/Few Hints
- Adjust `minInterval` configuration
- Modify trigger thresholds
- Review decision logic weights

## Future Enhancements

1. **Machine Learning Integration**: Train on successful hint patterns
2. **User Preference Learning**: Adapt to individual user styles
3. **Code Analysis**: Deep code understanding for better hints
4. **Multi-Language Support**: Hints in user's preferred language
5. **Metrics Collection**: Track hint effectiveness
6. **Custom Domain Training**: Add specialized domains
7. **Conversation Flow Analysis**: Understand multi-turn context better

## Conclusion

The Content-Aware Hint Injection System transforms OpenCode into an intelligent coding assistant that understands context, detects problems, and provides timely, relevant guidance. By analyzing prompt content in real-time, it delivers a personalized experience that helps users overcome challenges more effectively.

---

*Version: 1.0.0*  
*Last Updated: 2025-08-16*  
*Author: OpenCode AI Assistant System*