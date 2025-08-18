import { Auth } from "./index"
import { NamedError } from "../util/error"
import { z } from "zod"
import crypto from "crypto"

export namespace AuthChatGPT {
  const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
  const ISSUER = "https://auth.openai.com"
  const PLATFORM_URL = "https://platform.openai.com"
  const CHATGPT_BASE_URL = "https://chatgpt.com/backend-api"
  
  // PKCE (Proof Key for Code Exchange) implementation
  function generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString("base64url")
  }

  function generateCodeChallenge(verifier: string): string {
    return crypto.createHash("sha256").update(verifier).digest("base64url")
  }

  interface TokenResponse {
    access_token: string
    refresh_token: string
    id_token: string
    token_type: string
    expires_in: number
  }

  interface TokenData {
    access_token: string
    refresh_token: string
    id_token: string
    account_id?: string
    email?: string
  }

  interface JWTPayload {
    email?: string
    "https://api.openai.com/auth"?: {
      user_id?: string
      account_id?: string
    }
  }

  // Parse JWT token to extract account information
  function parseJWT(token: string): any {
    try {
      const parts = token.split(".")
      if (parts.length !== 3) return null
      return JSON.parse(Buffer.from(parts[1], "base64").toString())
    } catch {
      return null
    }
  }
  
  function parseIdToken(idToken: string): { accountId?: string; email?: string } {
    try {
      const payload = parseJWT(idToken)
      if (!payload) return {}
      
      const authData = payload["https://api.openai.com/auth"]
      
      return {
        accountId: authData?.chatgpt_account_id,
        email: payload.email,
      }
    } catch {
      return {}
    }
  }

  // Start OAuth flow with PKCE
  export async function authorize() {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const state = crypto.randomBytes(16).toString("base64url")
    
    // Build authorization URL
    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: "http://localhost:1455/auth/callback",
      scope: "openid profile email offline_access",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      id_token_add_organizations: "true",
      codex_cli_simplified_flow: "true",
      state,
    })
    
    const authUrl = `${ISSUER}/oauth/authorize?${params.toString()}`
    
    return {
      url: authUrl,
      state,
      codeVerifier,
      method: "auto" as const,
    }
  }

  // Exchange authorization code for tokens
  export async function exchangeCode(code: string, codeVerifier: string): Promise<TokenData> {
    console.log("🔄 ChatGPT Auth: Starting token exchange with OpenAI...")
    console.log("📝 ChatGPT Auth: Exchange parameters", {
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: "http://localhost:1455/auth/callback",
      hasCode: !!code,
      hasCodeVerifier: !!codeVerifier,
    })

    const response = await fetch(`${ISSUER}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "opencode",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        code,
        code_verifier: codeVerifier,
        redirect_uri: "http://localhost:1455/auth/callback",
      }),
    })

    console.log("📡 ChatGPT Auth: Token exchange response", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("❌ ChatGPT Auth: Token exchange failed", { status: response.status, error })
      throw new TokenExchangeError({ message: `Failed to exchange code: ${error}` })
    }

    const data: TokenResponse = await response.json()
    console.log("✅ ChatGPT Auth: Token exchange successful", {
      hasAccessToken: !!data.access_token,
      hasRefreshToken: !!data.refresh_token,
      hasIdToken: !!data.id_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
    })

    const { accountId, email } = parseIdToken(data.id_token)
    console.log("🔍 ChatGPT Auth: Parsed ID token", {
      accountId,
      email,
    })

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      id_token: data.id_token,
      account_id: accountId,
      email,
    }
  }

  // Refresh access token
  export async function refreshToken(refresh_token: string): Promise<TokenData> {
    const response = await fetch(`${ISSUER}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "opencode",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: CLIENT_ID,
        refresh_token,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new TokenRefreshError({ message: `Failed to refresh token: ${error}` })
    }

    const data: TokenResponse = await response.json()
    const { accountId, email } = parseIdToken(data.id_token)

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      id_token: data.id_token,
      account_id: accountId,
      email,
    }
  }

  // Get current access token, refreshing if necessary
  export async function access(): Promise<string | undefined> {
    const info = await Auth.get("chatgpt")
    if (!info || info.type !== "oauth") return

    // Check if token needs refresh (refresh 28 days after last refresh)
    const now = Date.now()
    if (info.expires && info.expires > now) {
      return info.access
    }

    try {
      // Refresh the token
      const tokenData = await refreshToken(info.refresh)
      
      // Store the new tokens
      await Auth.set("chatgpt", {
        type: "oauth",
        refresh: tokenData.refresh_token,
        access: tokenData.access_token,
        expires: now + (28 * 24 * 60 * 60 * 1000), // 28 days from now
      })

      // Store additional metadata separately if needed
      await storeMetadata({
        account_id: tokenData.account_id,
        email: tokenData.email,
        id_token: tokenData.id_token,
      })

      return tokenData.access_token
    } catch (error) {
      console.error("Failed to refresh ChatGPT token:", error)
      return undefined
    }
  }

  // Store additional metadata (account ID, email, etc.)
  async function storeMetadata(data: { account_id?: string; email?: string; id_token: string }) {
    // This could be stored in a separate file or as part of the auth data
    // For now, we'll store it in memory or a separate key
    const metadata = {
      account_id: data.account_id,
      email: data.email,
      id_token: data.id_token,
      updated_at: new Date().toISOString(),
    }
    
    // Store metadata separately if needed
    // This could be extended based on requirements
    return metadata
  }

  // Make authenticated request to ChatGPT backend API
  export async function makeRequest<T = any>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await access()
    if (!token) {
      throw new AuthenticationError({ message: "No valid ChatGPT token available" })
    }

    const info = await Auth.get("chatgpt")
    if (!info || info.type !== "oauth") {
      throw new AuthenticationError({ message: "ChatGPT authentication not configured" })
    }

    // Get account ID from stored metadata or token
    const accountId = await getAccountId()
    
    const response = await fetch(`${CHATGPT_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        "Authorization": `Bearer ${token}`,
        "chatgpt-account-id": accountId || "",
        "Content-Type": "application/json",
        "User-Agent": "opencode",
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new ApiRequestError({ 
        message: `ChatGPT API request failed: ${response.status}`,
        status: response.status,
        error,
      })
    }

    return response.json()
  }

  // Get stored account ID
  async function getAccountId(): Promise<string | undefined> {
    try {
      // Parse from current access token (most reliable)
      const info = await Auth.get("chatgpt")
      if (!info || info.type !== "oauth") return undefined
      
      const payload = parseJWT(info.access)
      const accountId = payload?.["https://api.openai.com/auth"]?.chatgpt_account_id
      
      if (accountId) return accountId
      
      // Fallback: try metadata
      const metadata = await Auth.get("chatgpt-metadata")
      if (metadata && metadata.type === "api") {
        const data = JSON.parse(metadata.key)
        if (data.account_id) return data.account_id
      }
      
      return undefined
    } catch (error) {
      console.error("Failed to get account ID:", error)
      return undefined
    }
  }

  // Error definitions
  export const TokenExchangeError = NamedError.create(
    "TokenExchangeError",
    z.object({
      message: z.string(),
    })
  )

  export const TokenRefreshError = NamedError.create(
    "TokenRefreshError",
    z.object({
      message: z.string(),
    })
  )

  export const AuthenticationError = NamedError.create(
    "AuthenticationError",
    z.object({
      message: z.string(),
    })
  )

  export const ApiRequestError = NamedError.create(
    "ApiRequestError",
    z.object({
      message: z.string(),
      status: z.number(),
      error: z.string(),
    })
  )
}