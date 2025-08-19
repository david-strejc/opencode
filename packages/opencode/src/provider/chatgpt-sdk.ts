import { AuthChatGPT } from "../auth/chatgpt"
import { Auth } from "../auth"
import { readFileSync } from "fs"
import path from "path"
import { randomUUID } from "crypto"

// ChatGPT SDK implementation for OpenCode
export namespace ChatGPTSDK {
  // Load Codex instructions (required for the API)
  let codexInstructions: string | null = null
  
  function getCodexInstructions(): string {
    if (!codexInstructions) {
      try {
        // Try to load from the opencode directory first
        const opencodeRoot = path.resolve(__dirname, "../../../..")
        codexInstructions = readFileSync(path.join(opencodeRoot, "codex-instructions.md"), "utf8")
      } catch {
        try {
          // Try to load from the copied file in current directory
          codexInstructions = readFileSync(path.join(process.cwd(), "codex-instructions.md"), "utf8")
        } catch {
          // Fallback to minimal instructions (won't work with Codex API)
          codexInstructions = "You are a helpful AI assistant. Be concise and helpful."
          console.warn("Warning: Codex instructions not found, ChatGPT may not work properly")
        }
      }
    }
    return codexInstructions
  }

  // Create a ChatGPT provider instance
  export function createChatGPT(_options: any = {}) {
    return {
      languageModel(modelID: string) {
        return new ChatGPTLanguageModel(modelID)
      },
      responses(modelID: string) {
        return new ChatGPTLanguageModel(modelID)
      }
    }
  }

  // Reasoning configuration types (aligned with Codex)
  type ReasoningEffort = "minimal" | "low" | "medium" | "high"
  type ReasoningSummary = "auto" | "concise" | "detailed"
  
  interface ReasoningConfig {
    effort: ReasoningEffort
    summary?: ReasoningSummary
  }

  // ChatGPT Language Model implementation
  class ChatGPTLanguageModel {
    constructor(private modelID: string) {}
    
    // Convert AI SDK tools format to ChatGPT Codex format
    convertToolsToCodexFormat(tools: any): any[] {
      if (!tools) return []
      
      const codexTools = []
      
      // Handle tools passed as an object (common in AI SDK)
      for (const [key, tool] of Object.entries(tools)) {
        if (!tool || typeof tool !== 'object') continue
        
        const toolDef = tool as any
        
        // AI SDK tools have name directly, not id
        const toolName = toolDef.name || toolDef.id || key
        const description = toolDef.description || `Tool: ${toolName}`
        const parameters = toolDef.inputSchema || toolDef.parameters || {}
        
        // Convert to Codex tool format (matching Codex ResponsesApiTool structure)
        codexTools.push({
          type: "function",
          name: toolName,
          description: description,
          parameters: parameters,
          strict: false
        })
      }
      
      return codexTools
    }
    
    // Implement doStream for AI SDK compatibility
    async doStream(options: any) {
      // For streaming, we use the same logic as doGenerate but handle streaming response
      options.mode = { type: "streaming" }
      const result = await this.doGenerate(options) as any
      
      // Check if result has stream property (streaming response)
      if (!result.stream) {
        throw new Error('Expected streaming response from doGenerate')
      }
      
      // Transform the result to match AI SDK's expected format
      // The AI SDK expects chunks with 'delta' property internally
      const transformStream = new TransformStream({
        transform(chunk: any, controller) {
          if (chunk.type === "text-delta") {
            // Transform our format to what AI SDK expects internally
            controller.enqueue({
              type: "text-delta",
              id: chunk.id || "text",
              delta: chunk.text,  // AI SDK expects 'delta' internally
            })
          } else {
            controller.enqueue(chunk)
          }
        }
      })
      
      return {
        stream: result.stream.pipeThrough(transformStream),
        rawResponse: result.rawResponse || new Response(),
        warnings: result.warnings || []
      }
    }
    
    private getReasoningConfig(options: any): ReasoningConfig | null {
      // Only GPT-5 supports reasoning
      const supportsReasoning = this.modelID === "gpt-5"
      if (!supportsReasoning) return null
      
      // Get reasoning effort from options or use default
      let effort: ReasoningEffort = "medium"
      if (options.reasoning?.effort) {
        effort = options.reasoning.effort
      } else if (options.experimental_providerMetadata?.openai?.reasoningEffort) {
        // Support AI SDK format
        effort = options.experimental_providerMetadata.openai.reasoningEffort
      } else if (options.experimental_providerMetadata?.chatgpt?.reasoningEffort) {
        // Support ChatGPT format
        effort = options.experimental_providerMetadata.chatgpt.reasoningEffort
      }
      
      // Get reasoning summary from options
      let summary: ReasoningSummary = "auto"
      if (options.reasoning?.summary) {
        summary = options.reasoning.summary
      } else if (options.experimental_providerMetadata?.chatgpt?.reasoningSummary) {
        summary = options.experimental_providerMetadata.chatgpt.reasoningSummary
      }
      
      return {
        effort,
        summary
      }
    }

    async doGenerate(_options: any) {
    const options = _options
      // Handle both messages array and prompt object
      let messages = options.messages || []
      
      // The AI SDK passes prompt as an array of message objects
      if (!messages.length && options.prompt) {
        if (Array.isArray(options.prompt)) {
          messages = options.prompt
        } else if (typeof options.prompt === 'string') {
          messages = [{
            role: "user",
            content: options.prompt
          }]
        }
      }
      
      if (!messages.length) {
        throw new Error("No messages provided")
      }

      // Convert messages to ChatGPT Codex format
      // Filter out system messages as they're handled via instructions
      const input = messages
        .filter((msg: any) => msg.role !== "system")
        .map((msg: any) => ({
          type: "message",
          role: msg.role === "assistant" ? "assistant" : "user",
          content: [
            {
              // Use output_text for assistant messages, input_text for user messages
              type: msg.role === "assistant" ? "output_text" : "input_text",
              text: typeof msg.content === "string" ? msg.content : msg.content.map((c: any) => c.text || c.content || "").join(" ")
            }
          ]
        }))

      // Get account ID from token
      const token = await AuthChatGPT.access()
      if (!token) throw new Error("No ChatGPT authentication")

      const auth = await Auth.get("chatgpt")
      if (!auth || auth.type !== "oauth") throw new Error("ChatGPT not authenticated")

      // Parse JWT to get account ID
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString())
      const accountId = payload?.["https://api.openai.com/auth"]?.chatgpt_account_id

      // Convert tools from AI SDK format to ChatGPT Codex format
      const tools = this.convertToolsToCodexFormat(options.tools || {})
      
      // Debug: Check if tools are being sent
      console.error(`DEBUG: Converted ${tools.length} tools for ChatGPT`)
      if (tools.length > 0) {
        console.error(`DEBUG: Tool names: ${tools.map(t => t.name).join(', ')}`)
      }

      // Build request for Codex API matching EXACT Codex implementation
      const request: any = {
        model: this.modelID,
        instructions: getCodexInstructions(),
        input,
        tools,
        tool_choice: "auto",  // Codex always uses "auto" as per client.rs
        parallel_tool_calls: false,
        reasoning: this.getReasoningConfig(options),
        store: false,
        stream: options.mode?.type === "streaming",
        include: [],
        prompt_cache_key: randomUUID()
      }

      const response = await fetch("https://chatgpt.com/backend-api/codex/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "chatgpt-account-id": accountId,
          "OpenAI-Beta": "responses=experimental",
          "session_id": randomUUID(),
          "originator": "opencode",
          "User-Agent": "opencode/1.0",
          "Accept": options.mode?.type === "streaming" ? "text/event-stream" : "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`ChatGPT API error: ${error}`)
      }

      // Handle streaming response
      if (options.mode?.type === "streaming") {
        return this.handleStreamingResponse(response, options)
      }

      // Handle regular response
      return this.handleRegularResponse(response, options)
    }

    async handleStreamingResponse(response: Response, _options: any) {
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      // Create a proper ReadableStream for AI SDK
      let textStarted = false
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (reader) {
              const { done, value } = await reader.read()
              if (done) {
                if (textStarted) {
                  controller.enqueue({ type: "text-end", id: "text" })
                }
                controller.close()
                break
              }

              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split("\n")
              buffer = lines.pop() || ""

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6)
                  if (data === "[DONE]") {
                    if (textStarted) {
                      controller.enqueue({ type: "text-end", id: "text" })
                    }
                    controller.close()
                    return
                  }
                  try {
                    const event = JSON.parse(data)
                    
                    // Debug: Log any function-related events
                    if (event.type && event.type.includes('function')) {
                      console.error(`DEBUG: Function event: ${event.type}`)
                    }
                    
                    // Extract text from delta events - match the actual Codex API response
                    if (event.type === "response.output_text.delta" && event.delta) {
                      // Emit text-start on first text delta
                      if (!textStarted) {
                        controller.enqueue({ type: "text-start", id: "text" })
                        textStarted = true
                      }
                      
                      controller.enqueue({
                        type: "text-delta",
                        text: event.delta,  // AI SDK expects 'text' not 'delta'
                        id: "text"  // AI SDK also needs an id
                      })
                    }
                    
                    // Handle tool calls - need to convert ChatGPT events to AI SDK format
                    else if (event.type === "response.function_call_arguments.done") {
                      // Extract tool name and arguments from the completed call
                      let toolName = "bash" // Default assumption
                      let parsedArgs = {}
                      try {
                        parsedArgs = JSON.parse(event.arguments || "{}")
                        
                        // Skip empty tool calls - ChatGPT sometimes generates incomplete calls
                        const hasValidArgs = Object.keys(parsedArgs).length > 0
                        if (!hasValidArgs) {
                          console.error(`DEBUG: Skipping empty tool call`)
                          return
                        }
                        
                        // Try to determine tool from arguments
                        const args = parsedArgs as any
                        if (args.command) toolName = "bash"
                        else if (args.filePath || args.content) toolName = "write"
                        else if (args.pattern) toolName = "grep"
                        else if (args.path && !args.filePath) toolName = "list"
                        
                        console.error(`DEBUG: Tool call completed - ${toolName}:`, JSON.stringify(parsedArgs, null, 2))
                        
                        // Send complete tool call to AI SDK with correct format
                        const toolCall = {
                          type: "tool-call",
                          toolCallId: event.item_id || event.id || "tool",
                          toolName,
                          input: parsedArgs  // AI SDK expects 'input', not 'args'
                        }
                        console.error(`DEBUG: Sending tool call to AI SDK:`, toolCall)
                        controller.enqueue(toolCall)
                        
                      } catch (e) {
                        console.error(`DEBUG: Failed to parse tool args:`, e, event.arguments)
                      }
                    }
                  } catch (e) {
                    // Skip parsing errors
                  }
                }
              }
            }
          } catch (error) {
            controller.error(error)
          }
        }
      })

      // Return the expected structure for AI SDK streaming
      return {
        stream,
        rawResponse: response,
        warnings: []
      }
    }

    async handleRegularResponse(response: Response, _options: any) {
      const data = await response.json()
      
      // Extract text from response
      let text = ""
      if (data.choices && data.choices[0]) {
        text = data.choices[0].message?.content || ""
      }

      return {
        text,
        toolCalls: [],
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        }
      }
    }
  }
}