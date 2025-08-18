#!/usr/bin/env bun

// Ask ChatGPT about Prague weather and save response
import { readFileSync, writeFileSync } from "fs"
import path from "path"
import os from "os"

async function askAboutPragueWeather() {
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
    
    // Load FULL Codex instructions
    const fullInstructions = readFileSync("codex-instructions.md", "utf8")
    
    // Create request asking about Prague weather
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
              text: "What's the current weather in Prague, Czech Republic? Please provide a brief summary."
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

    console.log("📤 Sending question about Prague weather...")
    
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
      console.log("✅ Request successful! Reading response...")
      
      // Collect all response data
      const allEvents = []
      let fullResponse = ""
      let messageContent = ""
      
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
              console.log("🏁 Stream completed")
              break
            }
            try {
              const event = JSON.parse(data)
              allEvents.push(event)
              
              // Extract message content
              if (event.type === "response.output_item.added") {
                console.log("📝 Output item added:", event.output_item?.type)
              }
              
              if (event.type === "response.text.delta") {
                const delta = event.delta
                messageContent += delta
                process.stdout.write(delta)
              }
              
              if (event.type === "response.output_item.done") {
                if (event.output_item?.content) {
                  const content = event.output_item.content
                  if (Array.isArray(content)) {
                    for (const item of content) {
                      if (item.type === "output_text") {
                        fullResponse += item.text
                      }
                    }
                  }
                }
              }
            } catch (e) {
              // Skip parsing errors
            }
          }
        }
      }
      
      console.log("\n\n" + "=".repeat(50))
      console.log("💾 Saving response to file...")
      
      // Save full event stream
      writeFileSync("prague-weather-events.json", JSON.stringify(allEvents, null, 2))
      console.log("   Events saved to: prague-weather-events.json")
      
      // Save just the message
      const finalMessage = fullResponse || messageContent
      writeFileSync("prague-weather-response.txt", finalMessage)
      console.log("   Response saved to: prague-weather-response.txt")
      
      console.log("\n📋 Final response:")
      console.log("=".repeat(50))
      console.log(finalMessage)
      console.log("=".repeat(50))
      
    } else {
      const error = await response.text()
      console.log("❌ Request failed:", error)
    }
    
  } catch (error) {
    console.error("❌ Error:", error)
  }
}

askAboutPragueWeather()