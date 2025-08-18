#!/usr/bin/env bun

// Test a simple ChatGPT conversation
import { readFileSync } from "fs"
import path from "path"
import os from "os"

async function testConversation() {
  console.log("🗣️  Testing ChatGPT conversation...")
  
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
    const accountId = payload?.["https://api.openai.com/auth"]?.chatgpt_account_id || "0a85a550-ce51-4294-88f1-0370dbe2744d"
    console.log("🔑 Using account ID:", accountId)
    
    // Create a simple conversation
    const conversationRequest = {
      action: "next",
      messages: [
        {
          id: crypto.randomUUID(),
          author: { role: "user" },
          content: {
            content_type: "text",
            parts: ["Hello! Just testing the API connection. Please respond with 'API test successful!'"],
          },
        },
      ],
      model: "gpt-5",
      parent_message_id: crypto.randomUUID(),
      timezone_offset_min: new Date().getTimezoneOffset(),
    }

    console.log("📤 Sending conversation request...")
    const response = await fetch("https://chatgpt.com/backend-api/conversation", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "chatgpt-account-id": accountId,
        "Content-Type": "application/json",
        "User-Agent": "opencode",
      },
      body: JSON.stringify(conversationRequest),
    })

    console.log("📨 Response status:", response.status)
    
    if (response.ok) {
      const data = await response.json()
      console.log("✅ Conversation successful!")
      console.log("   Conversation ID:", data.conversation_id)
      console.log("   Message ID:", data.message?.id)
      console.log("   Response:", data.message?.content?.parts?.[0] || "No content")
    } else {
      const error = await response.text()
      console.log("❌ Conversation failed:", error)
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error)
  }
}

testConversation()