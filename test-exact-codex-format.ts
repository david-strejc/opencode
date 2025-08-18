#!/usr/bin/env bun

// Test with EXACT Codex format based on client.rs analysis
import { readFileSync } from "fs"
import path from "path"
import os from "os"

async function testExactCodexFormat() {
  console.log("🧪 Testing with EXACT Codex format from client.rs...")
  
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
    
    // Base instructions from Codex prompt.md
    const baseInstructions = `You are a coding agent running in the Codex CLI, a terminal-based coding assistant. Codex CLI is an open source project led by OpenAI. You are expected to be precise, safe, and helpful.

Your capabilities:

- Receive user prompts and other context provided by the harness, such as files in the workspace.
- Communicate with the user by streaming thinking & responses, and by making & updating plans.
- Emit function calls to run terminal commands and apply patches. Depending on how this specific run is configured, you can request that these function calls be escalated to the user for approval before running. More on this in the "Sandbox and approvals" section.

Within this context, Codex refers to the open-source agentic coding interface (not the old Codex language model built by OpenAI).`

    // Create request in EXACT Codex ResponsesApiRequest format
    const request = {
      model: "gpt-5",
      instructions: baseInstructions,
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
      tools: [], // Empty tools array like Codex
      tool_choice: "auto",
      parallel_tool_calls: false,
      reasoning: null, // No reasoning for simple test
      store: false,
      stream: true,
      include: [],
      prompt_cache_key: crypto.randomUUID()
    }

    console.log("📤 Sending to Codex /responses endpoint...")
    console.log("Request:", JSON.stringify(request, null, 2))
    
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
      const data = await response.text()
      console.log("✅ SUCCESS! Codex endpoint working!")
      console.log("Response (first 500 chars):", data.substring(0, 500))
    } else {
      const error = await response.text()
      console.log("❌ Failed:", error)
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error)
  }
}

testExactCodexFormat()