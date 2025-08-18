#!/usr/bin/env bun

// Extract account ID from JWT
import { readFileSync } from "fs"
import path from "path"
import os from "os"

function parseJWT(token: string) {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString())
    return payload
  } catch {
    return null
  }
}

async function extractAccountId() {
  const authPath = path.join(os.homedir(), ".local/share/opencode/auth.json")
  const authData = JSON.parse(readFileSync(authPath, "utf8"))
  
  // Parse access token
  const accessToken = authData.chatgpt.access
  const accessPayload = parseJWT(accessToken)
  
  console.log("Access token payload:")
  console.log(JSON.stringify(accessPayload, null, 2))
  
  const accountId = accessPayload?.["https://api.openai.com/auth"]?.chatgpt_account_id
  console.log("\n✅ Account ID from access token:", accountId)
  
  // Parse ID token from metadata
  const metadata = JSON.parse(authData["chatgpt-metadata"].key)
  const idToken = metadata.id_token
  const idPayload = parseJWT(idToken)
  
  console.log("\nID token payload:")
  console.log(JSON.stringify(idPayload?.["https://api.openai.com/auth"], null, 2))
  
  const accountIdFromId = idPayload?.["https://api.openai.com/auth"]?.chatgpt_account_id
  console.log("\n✅ Account ID from ID token:", accountIdFromId)
}

extractAccountId()