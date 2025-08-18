#!/usr/bin/env bun

// Ask ChatGPT with simple instructions
import { readFileSync, writeFileSync } from "fs"
import path from "path"
import os from "os"

async function askSimpleQuestion() {
  console.log("🌤️  Asking ChatGPT about Prague weather with simple instructions...")
  
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
    
    // Use SIMPLE instructions
    const simpleInstructions = "You are a helpful assistant. Answer questions directly and concisely."
    
    // Create request asking about Prague weather
    const request = {
      model: "gpt-5",
      instructions: simpleInstructions,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: "What's the current weather in Prague, Czech Republic? Please provide temperature and conditions."
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

    console.log("📤 Sending question...")
    
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
      
      let fullResponse = ""
      
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
              
              // Look for actual text output
              if (event.type === "response.text.delta") {
                const delta = event.delta
                fullResponse += delta
                process.stdout.write(delta)
              }
              
              // Also check output items
              if (event.type === "response.output_item.done" && event.output_item) {
                if (event.output_item.type === "message" && event.output_item.content) {
                  for (const content of event.output_item.content) {
                    if (content.type === "output_text") {
                      if (!fullResponse.includes(content.text)) {
                        fullResponse += content.text
                        console.log(content.text)
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
      
      console.log("\n" + "=".repeat(50))
      
      // Save response
      writeFileSync("prague-weather-answer.txt", fullResponse || "No response received")
      console.log("💾 Response saved to: prague-weather-answer.txt")
      
    } else {
      const error = await response.text()
      console.log("❌ Request failed:", error)
    }
    
  } catch (error) {
    console.error("❌ Error:", error)
  }
}

askSimpleQuestion()