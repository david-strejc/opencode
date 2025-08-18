#!/usr/bin/env bun

// Test with COMPLETE Codex format including full instructions
import { readFileSync } from "fs"
import path from "path"
import os from "os"

async function testFullCodex() {
  console.log("🧪 Testing with COMPLETE Codex format...")
  
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
    console.log("🔑 Using account ID:", accountId)
    
    // Load FULL Codex instructions
    const fullInstructions = readFileSync("codex-instructions.md", "utf8")
    console.log("📄 Instructions length:", fullInstructions.length, "chars")
    
    // Create request in EXACT Codex ResponsesApiRequest format
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
              text: "Say 'API test successful!'"
            }
          ]
        }
      ],
      tools: [],
      tool_choice: "auto",
      parallel_tool_calls: false,
      reasoning: null,
      store: false, // ALWAYS false for ChatGPT auth
      stream: true,
      include: [],
      prompt_cache_key: crypto.randomUUID()
    }

    console.log("📤 Sending to Codex /responses endpoint...")
    
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
    console.log("Headers:", Object.fromEntries(response.headers.entries()))
    
    if (response.ok) {
      console.log("✅ SUCCESS! Codex endpoint working!")
      
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
              console.log("Event:", event.type, event)
            } catch (e) {
              // Skip parsing errors
            }
          }
        }
      }
    } else {
      const error = await response.text()
      console.log("❌ Failed:", error)
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error)
  }
}

testFullCodex()