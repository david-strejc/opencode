#!/usr/bin/env bun

// Test integrated ChatGPT provider in OpenCode
import { Provider } from "./packages/opencode/src/provider/provider"
import { Auth } from "./packages/opencode/src/auth"
import { App } from "./packages/opencode/src/app/app"

async function testIntegratedChatGPT() {
  console.log("🧪 Testing integrated ChatGPT provider...")
  
  try {
    // Initialize app context
    await App.provide({ cwd: process.cwd() }, async () => {
      // Check authentication
      console.log("\n1️⃣ Checking ChatGPT authentication...")
      const auth = await Auth.get("chatgpt")
      if (!auth) {
        console.log("❌ ChatGPT not authenticated. Please run: opencode auth login")
        return
      }
      console.log("✅ ChatGPT authenticated:", auth.type)
      
      // List available providers
      console.log("\n2️⃣ Listing available providers...")
      const providers = await Provider.list()
      console.log("Available providers:", Object.keys(providers))
      
      // Check if ChatGPT provider is available
      const chatgptProvider = providers["chatgpt"]
      if (chatgptProvider) {
        console.log("✅ ChatGPT provider found!")
        console.log("   Source:", chatgptProvider.source)
        console.log("   Models:", Object.keys(chatgptProvider.info.models))
      } else {
        console.log("⚠️ ChatGPT provider not found in list")
      }
      
      // Try to get a ChatGPT model
      console.log("\n3️⃣ Getting ChatGPT model...")
      try {
        const model = await Provider.getModel("chatgpt", "gpt-5")
        console.log("✅ Got GPT-5 model!")
        console.log("   Model info:", model.info.name)
        console.log("   Context limit:", model.info.limit.context)
        console.log("   Output limit:", model.info.limit.output)
      } catch (error) {
        console.log("❌ Failed to get model:", error)
      }
      
      // Test a simple generation
      console.log("\n4️⃣ Testing model generation...")
      try {
        const model = await Provider.getModel("chatgpt", "gpt-5")
        if (model.language.doGenerate) {
          const result = await model.language.doGenerate({
            messages: [
              { role: "user", content: "Say 'Hello from integrated ChatGPT!'" }
            ],
            mode: { type: "regular" }
          })
          console.log("✅ Generation successful!")
          console.log("   Response:", result.text)
        } else {
          console.log("⚠️ Model doesn't have doGenerate method")
        }
      } catch (error) {
        console.log("❌ Generation failed:", error)
      }
      
      console.log("\n✨ Test complete!")
    })
  } catch (error) {
    console.error("❌ Test failed:", error)
  }
}

testIntegratedChatGPT()