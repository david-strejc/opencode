#!/usr/bin/env bun

// Test script for ChatGPT API access
import { AuthChatGPT } from "./packages/opencode/src/auth/chatgpt"
import { ChatGPTProvider } from "./packages/opencode/src/provider/chatgpt"

async function testChatGPTAPI() {
  console.log("🧪 Testing ChatGPT API Access...")
  console.log("=" .repeat(50))
  
  try {
    // Test 1: Get access token
    console.log("\n1. Testing token access...")
    const token = await AuthChatGPT.access()
    if (token) {
      console.log("✅ Access token retrieved successfully")
      console.log("   Token length:", token.length)
      console.log("   Token type:", token.startsWith("eyJ") ? "JWT" : "Other")
    } else {
      console.log("❌ No access token available")
      return
    }

    // Test 2: Get account information
    console.log("\n2. Testing account info...")
    try {
      const accountInfo = await ChatGPTProvider.getAccountInfo()
      console.log("✅ Account info retrieved:")
      console.log("   Account data:", JSON.stringify(accountInfo, null, 2))
    } catch (error) {
      console.log("⚠️  Account info failed:", error)
    }

    // Test 3: Get available models
    console.log("\n3. Testing model list...")
    try {
      const models = await ChatGPTProvider.getModels()
      console.log("✅ Models retrieved:")
      console.log("   Available models:", models.length)
      if (models.length > 0) {
        console.log("   Model examples:", models.slice(0, 3).map(m => m?.id || m))
      }
    } catch (error) {
      console.log("⚠️  Model list failed:", error)
    }

    // Test 4: Simple conversation test
    console.log("\n4. Testing simple conversation...")
    try {
      const response = await ChatGPTProvider.startConversation(
        "Hello! Just testing the API connection. Please respond with 'API test successful!'",
        "gpt-4"
      )
      console.log("✅ Conversation started successfully:")
      console.log("   Conversation ID:", response.conversation_id)
      console.log("   Message ID:", response.message?.id)
      console.log("   Response:", response.message?.content?.parts?.[0] || "No content")
    } catch (error) {
      console.log("⚠️  Conversation test failed:", error)
    }

    // Test 5: Get conversation history
    console.log("\n5. Testing conversation history...")
    try {
      const conversations = await ChatGPTProvider.getConversations(0, 5)
      console.log("✅ Conversation history retrieved:")
      console.log("   Total conversations:", conversations.length)
      if (conversations.length > 0) {
        console.log("   Recent conversation:", conversations[0]?.title || "Untitled")
      }
    } catch (error) {
      console.log("⚠️  Conversation history failed:", error)
    }

    console.log("\n" + "=" .repeat(50))
    console.log("🏁 ChatGPT API test completed!")
    
  } catch (error) {
    console.error("\n❌ Test failed with error:")
    console.error(error)
  }
}

// Run the test
console.log("ChatGPT API Test Suite")
console.log("Testing your ChatGPT Plus OAuth access...")
testChatGPTAPI().catch(console.error)