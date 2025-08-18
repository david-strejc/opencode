# Hint Injection Implementation Guide for OpenCode

## Overview
This guide shows how to inject custom "HINT:" messages into prompts every N messages (e.g., every 3rd prompt).

## Quick Implementation

### Method 1: Plugin Approach (Recommended)
Create a plugin file at `.opencode/plugin/hint-injector.js`:

```javascript
// .opencode/plugin/hint-injector.js
let messageCounts = new Map()

module.exports = function({ client, app }) {
  return {
    async "chat.message"(input, output) {
      const sessionID = output.message?.sessionID || "default"
      const count = (messageCounts.get(sessionID) || 0) + 1
      messageCounts.set(sessionID, count)
      
      // Every 3rd message, inject a hint
      if (count % 3 === 0) {
        const hint = "\n\n💡 HINT: Consider edge cases and performance implications."
        
        // Append hint to the last text part
        if (output.parts && output.parts.length > 0) {
          const lastPart = output.parts[output.parts.length - 1]
          if (lastPart.type === "text" && lastPart.content) {
            lastPart.content += hint
            console.log(`[HintInjector] Injected hint at message #${count}`)
          }
        }
      }
    }
  }
}
```

### Method 2: Direct Integration in Session Handler

To integrate directly into OpenCode's core, modify `/packages/opencode/src/session/index.ts`:

```typescript
// At line ~617, right before Plugin.trigger("chat.message", ...)
import { enhancePromptWithHint } from "./hint-integration"

// Enhance user message parts with hints
for (const part of userParts) {
  if (part.type === "text" && part.content) {
    part.content = enhancePromptWithHint(part.content, input.sessionID)
  }
}

await Plugin.trigger("chat.message", {}, { message: userMsg, parts: userParts })
```

### Method 3: Configuration-Based Hooks

Add to your OpenCode config file:

```json
{
  "experimental": {
    "hook": {
      "message_interval": {
        "3": {
          "command": ["echo", "HINT: Remember to validate inputs"],
          "inject_as": "system_message"
        }
      }
    }
  }
}
```

## Full Integration Example

Here's a complete example showing hint injection with context awareness:

```typescript
// packages/opencode/src/session/hint-injector.ts
export class HintInjector {
  private static counts = new Map<string, number>()
  private static readonly INTERVAL = 3
  
  private static hints = [
    "💡 HINT: Consider error handling and edge cases.",
    "💡 HINT: Think about performance and scalability.",
    "💡 HINT: Check if similar code exists in the project.",
    "💡 HINT: Remember to validate inputs and outputs.",
    "💡 HINT: Consider breaking this into smaller functions."
  ]
  
  static inject(prompt: string, sessionID: string): string {
    const count = (this.counts.get(sessionID) || 0) + 1
    this.counts.set(sessionID, count)
    
    if (count % this.INTERVAL === 0) {
      const hintIndex = Math.floor((count / this.INTERVAL) - 1) % this.hints.length
      const hint = this.hints[hintIndex]
      
      console.log(`[Hint] Injecting at message #${count}: ${hint}`)
      return `${prompt}\n\n${hint}`
    }
    
    return prompt
  }
  
  static reset(sessionID: string) {
    this.counts.delete(sessionID)
  }
}
```

## Testing the Implementation

### Test Script
```bash
#!/bin/bash
# test-hints.sh

echo "Testing hint injection every 3 messages..."

# Message 1 - No hint
~/.opencode/bin/opencode run "Message 1: What is 2+2?" -m chatgpt/gpt-5

# Message 2 - No hint  
~/.opencode/bin/opencode run "Message 2: What is 3+3?" -m chatgpt/gpt-5 -c

# Message 3 - HINT INJECTED!
~/.opencode/bin/opencode run "Message 3: What is 4+4?" -m chatgpt/gpt-5 -c
# This should include: "💡 HINT: Consider error handling and edge cases."

# Message 4 - No hint
~/.opencode/bin/opencode run "Message 4: What is 5+5?" -m chatgpt/gpt-5 -c

# Message 5 - No hint
~/.opencode/bin/opencode run "Message 5: What is 6+6?" -m chatgpt/gpt-5 -c

# Message 6 - HINT INJECTED!
~/.opencode/bin/opencode run "Message 6: What is 7+7?" -m chatgpt/gpt-5 -c
# This should include: "💡 HINT: Think about performance and scalability."
```

## Advanced Features

### Dynamic Hint Selection Based on Context
```javascript
function getContextualHint(message, count) {
  const lower = message.toLowerCase()
  
  if (lower.includes('error') || lower.includes('bug')) {
    return "💡 HINT: Check error logs and stack traces for clues."
  }
  
  if (lower.includes('performance') || lower.includes('slow')) {
    return "💡 HINT: Profile the code to find bottlenecks."
  }
  
  if (lower.includes('test')) {
    return "💡 HINT: Consider edge cases and error conditions in tests."
  }
  
  // Default rotating hints
  const hints = [/* ... */]
  return hints[Math.floor(count / 3) % hints.length]
}
```

### Conditional Injection Based on Model Response
```javascript
// Inject hints after specific tool usage
async "tool.execute.after"(input, output) {
  if (input.tool === "bash" && output.exitCode !== 0) {
    // Inject debugging hint on next message
    scheduleHint(input.sessionID, "💡 HINT: Check the error output and try debugging step by step.")
  }
}
```

## Configuration Options

### Environment Variables
```bash
export OPENCODE_HINT_INTERVAL=3        # Inject every N messages
export OPENCODE_HINT_ENABLED=true      # Enable/disable hints
export OPENCODE_HINT_MODE=append       # append|prepend|replace
```

### Runtime Configuration
```typescript
// In your code or plugin
HintSystem.setInterval(5)  // Change to every 5 messages
HintSystem.setEnabled(true)
HintSystem.addHints([
  "Custom hint 1",
  "Custom hint 2"
])
```

## Integration Points

1. **Session Processing** (`/src/session/index.ts`): Lines 617-624
2. **Plugin System** (`/src/plugin/index.ts`): Hook registration
3. **Message Updates** (`/src/message/v2.ts`): Event publishing
4. **System Prompts** (`/src/session/system.ts`): Prompt assembly

## Benefits

1. **Improved AI Responses**: Regular hints help maintain quality
2. **Context Awareness**: Adapt hints based on conversation flow  
3. **Learning Reinforcement**: Remind about best practices
4. **Debugging Aid**: Inject helpful debugging tips when needed
5. **Configurable**: Easy to adjust frequency and content

## Troubleshooting

### Hints Not Appearing
- Check if plugin is loaded: Look for `[HintInjector]` in logs
- Verify session continuity: Use `-c` flag to continue session
- Check message count: Print count in console logs

### Wrong Hint Timing
- Session might be resetting - use `--session` flag
- Check if multiple instances are running
- Verify INTERVAL setting matches expectation

### Custom Hints Not Working  
- Ensure hints array is properly updated
- Check hint index calculation
- Verify session state is maintained

## Next Steps

1. Build and install the updated OpenCode
2. Create your plugin file
3. Test with sample messages
4. Customize hints for your workflow
5. Add context-aware hint selection

This implementation provides a robust, configurable system for injecting helpful hints into your OpenCode conversations at regular intervals!