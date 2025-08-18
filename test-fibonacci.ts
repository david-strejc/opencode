#!/usr/bin/env bun

// Ask Codex to write Fibonacci code
import { readFileSync, writeFileSync } from "fs"
import path from "path"
import os from "os"

async function askForFibonacci() {
  console.log("🌤️  Asking ChatGPT about Prague weather...")
  
  try {
    // Get token and account ID
    const authPath = path.join(os.homedir(), ".local/share/opencode/auth.json")
    const authData = JSON.parse(readFileSync(authPath, "utf8"))
    const token = authData.chatgpt.access
    
    // Get account ID from access token
    function parseJWT(token: string) {
      const parts = token.split(".")
      if (parts.length !== 3) return null
      return JSON.parse(Buffer.from(parts[1], "base64").toString())
    }
    
    const payload = parseJWT(token)
    const accountId = payload?.["https://api.openai.com/auth"]?.chatgpt_account_id
    console.log("🔑 Account ID:", accountId)
    
    // Load FULL Codex instructions (it needs these)
    const fullInstructions = readFileSync("codex-instructions.md", "utf8")
    console.log("📄 Using Codex instructions:", fullInstructions.length, "chars")
    
    // Create request asking about weather
    const request = {
      model: "gpt-5",
      instructions: fullInstructions,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: "What's the current weather in Prague, Czech Republic? Please provide temperature, conditions, and a brief forecast."
            }
          ]
        }
      ],
      tools: [],
      tool_choice: "auto",
      parallel_tool_calls: false,
      reasoning: null,
      store: false,
      stream: true,
      include: [],
      prompt_cache_key: crypto.randomUUID()
    }

    console.log("📤 Sending weather question to ChatGPT...")
    
    const response = await fetch("https://chatgpt.com/backend-api/codex/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "chatgpt-account-id": accountId,
        "OpenAI-Beta": "responses=experimental",
        "session_id": crypto.randomUUID(),
        "originator": "codex_cli_rs",
        "User-Agent": "codex/0.1.0",
        "Accept": "text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    })

    console.log("📨 Response status:", response.status)
    
    if (response.ok) {
      console.log("✅ Request successful! Reading response...\n")
      console.log("=" .repeat(50))
      
      let fullResponse = ""
      let messageContent = ""
      const allEvents = []
      
      // Read streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        
        // Process SSE events
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") {
              console.log("\n🏁 Stream completed")
              break
            }
            try {
              const event = JSON.parse(data)
              allEvents.push(event)
              
              // Debug: Show event types
              if (event.type && !event.type.includes("in_progress")) {
                console.log(`\n[Event: ${event.type}]`)
              }
              
              // Look for text deltas - CORRECT FIELD
              if (event.type === "response.output_text.delta" && event.delta) {
                fullResponse += event.delta
                process.stdout.write(event.delta)
              }
              
              // Look for output items
              if (event.type === "response.output_item.done" && event.output_item) {
                console.log("\n[Output item done]:", event.output_item.type)
                
                if (event.output_item.type === "message" && event.output_item.content) {
                  for (const content of event.output_item.content) {
                    if (content.type === "output_text") {
                      messageContent += content.text
                      console.log("📝 Message content:", content.text)
                    }
                  }
                }
              }
              
              // Look for reasoning
              if (event.type === "response.reasoning.done" && event.reasoning) {
                console.log("\n[Reasoning completed]")
                if (event.reasoning.content) {
                  console.log("💭 Reasoning:", event.reasoning.content.substring(0, 200) + "...")
                }
              }
            } catch (e) {
              // Skip parsing errors
            }
          }
        }
      }
      
      console.log("\n" + "=".repeat(50))
      
      // Save all events
      writeFileSync("weather-events.json", JSON.stringify(allEvents, null, 2))
      console.log("💾 Events saved to: weather-events.json")
      
      // Save response
      const finalResponse = fullResponse || messageContent || "No response content found"
      writeFileSync("weather-response.txt", finalResponse)
      console.log("💾 Response saved to: weather-response.txt")
      
      console.log("\n📋 Final response length:", finalResponse.length, "chars")
      
      if (finalResponse.length === 0) {
        console.log("\n⚠️  No text response received. Checking event types...")
        const eventTypes = [...new Set(allEvents.map(e => e.type))].filter(Boolean)
        console.log("Event types seen:", eventTypes)
      }
      
    } else {
      const error = await response.text()
      console.log("❌ Request failed:", error)
    }
    
  } catch (error) {
    console.error("❌ Error:", error)
  }
}

askForFibonacci()