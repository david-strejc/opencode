#!/usr/bin/env bun

// Test script to check ChatGPT token storage
import { Auth } from "./packages/opencode/src/auth/index"
import { AuthChatGPT } from "./packages/opencode/src/auth/chatgpt"

async function checkTokens() {
  console.log("🔍 Checking ChatGPT token storage...")
  console.log("=" .repeat(50))
  
  try {
    // Check main auth storage
    console.log("\n1. Checking main auth storage...")
    const chatgptAuth = await Auth.get("chatgpt")
    if (chatgptAuth) {
      console.log("✅ Found ChatGPT auth entry:", {
        type: chatgptAuth.type,
        hasRefresh: !!(chatgptAuth as any).refresh,
        hasAccess: !!(chatgptAuth as any).access,
        expires: (chatgptAuth as any).expires,
        expiresDate: new Date((chatgptAuth as any).expires).toISOString(),
      })
    } else {
      console.log("❌ No ChatGPT auth entry found")
    }
    
    // Check metadata storage
    console.log("\n2. Checking metadata storage...")
    const metadata = await Auth.get("chatgpt-metadata")
    if (metadata) {
      console.log("✅ Found ChatGPT metadata:", {
        type: metadata.type,
        hasKey: !!(metadata as any).key,
      })
      
      if ((metadata as any).key) {
        try {
          const parsed = JSON.parse((metadata as any).key)
          console.log("📋 Metadata contents:", {
            hasAccountId: !!parsed.account_id,
            hasEmail: !!parsed.email,
            hasIdToken: !!parsed.id_token,
            accountId: parsed.account_id,
            email: parsed.email,
          })
        } catch (e) {
          console.log("⚠️  Could not parse metadata key")
        }
      }
    } else {
      console.log("❌ No ChatGPT metadata found")
    }
    
    // Test token access
    console.log("\n3. Testing token access...")
    const accessToken = await AuthChatGPT.access()
    if (accessToken) {
      console.log("✅ Successfully retrieved access token:", {
        tokenLength: accessToken.length,
        tokenPrefix: accessToken.substring(0, 20) + "...",
      })
    } else {
      console.log("❌ Could not retrieve access token")
    }
    
    // List all auth entries
    console.log("\n4. All stored auth entries:")
    const allAuth = await Auth.list()
    console.log("📋 Available providers:", Object.keys(allAuth))
    
    console.log("\n" + "=" .repeat(50))
    console.log("🏁 Token check completed")
    
  } catch (error) {
    console.error("\n❌ Error checking tokens:")
    console.error(error)
  }
}

// Run the check
console.log("ChatGPT Token Storage Check")
console.log("=" .repeat(50))
checkTokens().catch(console.error)