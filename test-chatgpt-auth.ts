#!/usr/bin/env bun

// Test script for ChatGPT authentication
import { AuthChatGPT } from "./packages/opencode/src/auth/chatgpt"
import { ChatGPTProvider } from "./packages/opencode/src/provider/chatgpt"

async function testAuth() {
  console.log("🔐 Testing ChatGPT Authentication...")
  console.log("=" .repeat(50))
  
  try {
    // Test 1: Generate authorization URL
    console.log("\n1. Testing authorization URL generation...")
    const authData = await AuthChatGPT.authorize()
    console.log("✅ Authorization URL generated successfully")
    console.log("   URL:", authData.url)
    console.log("   State:", authData.state)
    console.log("   Code Verifier length:", authData.codeVerifier.length)
    
    // Test 2: Check if we can access stored tokens
    console.log("\n2. Checking for existing authentication...")
    const token = await AuthChatGPT.access()
    if (token) {
      console.log("✅ Found existing authentication token")
      
      // Test 3: Try to get account info
      console.log("\n3. Testing API access with token...")
      try {
        const accountInfo = await ChatGPTProvider.getAccountInfo()
        if (accountInfo) {
          console.log("✅ Successfully accessed ChatGPT API")
          console.log("   Account info:", JSON.stringify(accountInfo, null, 2))
        }
      } catch (apiError) {
        console.log("⚠️  API access failed (token might be expired or invalid)")
        console.log("   Error:", apiError)
      }
      
      // Test 4: Try to get available models
      console.log("\n4. Testing model fetching...")
      try {
        const models = await ChatGPTProvider.getModels()
        console.log("✅ Successfully fetched models")
        console.log("   Available models:", models.length)
      } catch (modelError) {
        console.log("⚠️  Model fetching failed")
        console.log("   Error:", modelError)
      }
    } else {
      console.log("ℹ️  No existing authentication found")
      console.log("   Run 'opencode auth login' and select 'chatgpt' to authenticate")
    }
    
    console.log("\n" + "=" .repeat(50))
    console.log("✅ All tests completed")
    
  } catch (error) {
    console.error("\n❌ Test failed with error:")
    console.error(error)
    process.exit(1)
  }
}

// Run the test
console.log("ChatGPT Authentication Test Suite")
console.log("=" .repeat(50))
testAuth().catch(console.error)