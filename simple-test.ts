#!/usr/bin/env bun

// Simple test script without complex imports
import { readFileSync } from "fs"
import path from "path"
import os from "os"

async function testToken() {
  console.log("🧪 Testing ChatGPT token access...")
  
  try {
    // Read auth.json directly
    const authPath = path.join(os.homedir(), ".local/share/opencode/auth.json")
    const authData = JSON.parse(readFileSync(authPath, "utf8"))
    
    console.log("✅ Auth file loaded")
    console.log("   Has ChatGPT tokens:", !!authData.chatgpt)
    
    if (authData.chatgpt) {
      const token = authData.chatgpt.access
      console.log("   Token length:", token.length)
      console.log("   Token type:", token.startsWith("eyJ") ? "JWT" : "Other")
      console.log("   Expires:", new Date(authData.chatgpt.expires))
      
      // Get account ID from metadata
      const metadata = JSON.parse(authData["chatgpt-metadata"].key)
      console.log("   Account ID:", metadata.account_id)
      
      // Test models endpoint
      console.log("\n🔍 Testing ChatGPT API call...")
      const response = await fetch("https://chatgpt.com/backend-api/models", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "chatgpt-account-id": metadata.account_id || "",
          "Content-Type": "application/json",
          "User-Agent": "opencode",
        },
      })
      
      console.log("   Status:", response.status)
      console.log("   OK:", response.ok)
      
      if (response.ok) {
        const data = await response.json()
        console.log("✅ API call successful!")
        console.log("   Account data:", JSON.stringify(data, null, 2))
      } else {
        const error = await response.text()
        console.log("❌ API call failed:", error)
      }
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error)
  }
}

testToken()