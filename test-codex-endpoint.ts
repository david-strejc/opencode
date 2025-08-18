#!/usr/bin/env bun

// Test using the Codex endpoint instead of conversation
import { readFileSync } from "fs"
import path from "path"
import os from "os"

async function testCodexEndpoint() {
  console.log("🧪 Testing Codex /responses endpoint...")
  
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
    
    // Create request in Codex format (based on Codex protocol)
    const request = {
      model: "gpt-5",
      input: [
        {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Hello! Just testing the API connection. Please respond with 'API test successful!'"
            }
          ]
        }
      ],
      instructions: "",
      stream: true,
      store: false
    }

    console.log("📤 Sending to Codex endpoint...")
    const response = await fetch("https://chatgpt.com/backend-api/codex/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "chatgpt-account-id": accountId,
        "Content-Type": "application/json",
        "User-Agent": "opencode",
      },
      body: JSON.stringify(request),
    })

    console.log("📨 Response status:", response.status)
    
    if (response.ok) {
      const data = await response.text()
      console.log("✅ Codex endpoint successful!")
      console.log("   Response:", data)
    } else {
      const error = await response.text()
      console.log("❌ Codex endpoint failed:", error)
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error)
  }
}

testCodexEndpoint()