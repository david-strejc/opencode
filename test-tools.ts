#!/usr/bin/env bun

import { spawn } from "child_process"

async function testToolUsage() {
  console.log("🧪 Testing ChatGPT tool usage...")
  
  const opencode = spawn("~/.opencode/bin/opencode", [
    "run",
    "Create a file called test.txt with the content 'Hello from ChatGPT'",
    "-m", "chatgpt/gpt-5"
  ], {
    shell: true,
    stdio: ["inherit", "pipe", "pipe"]
  })
  
  let stdout = ""
  let stderr = ""
  
  opencode.stdout.on("data", (data) => {
    stdout += data.toString()
    process.stdout.write(data)
  })
  
  opencode.stderr.on("data", (data) => {
    stderr += data.toString()
    process.stderr.write(data)
  })
  
  opencode.on("close", (code) => {
    console.log("\n📊 Process exited with code:", code)
    
    // Check if we captured tool information
    if (stderr.includes("ChatGPT SDK: Sending tools:")) {
      console.log("\n✅ Tools were sent to ChatGPT API")
    } else {
      console.log("\n⚠️  No tools were sent to ChatGPT API")
    }
  })
}

testToolUsage()