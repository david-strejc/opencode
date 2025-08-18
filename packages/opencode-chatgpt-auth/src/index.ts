import type { Plugin } from "../../plugin/src/index"
import { AuthChatGPT } from "../../opencode/src/auth/chatgpt"
import http from "http"
import { URL } from "url"

export default (async ({ client }) => {
  let server: http.Server | null = null
  let pendingAuth: {
    codeVerifier: string
    state: string
    resolve: (value: any) => void
    reject: (reason?: any) => void
  } | null = null

  // Create callback server for OAuth flow
  const createCallbackServer = async () => {
    return new Promise<{ code: string }>((resolve, reject) => {
      server = http.createServer(async (req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        
        if (url.pathname === "/auth/callback") {
          const code = url.searchParams.get("code")
          const state = url.searchParams.get("state")
          const error = url.searchParams.get("error")
          
          console.log("🌐 ChatGPT OAuth: Callback received", {
            hasCode: !!code,
            hasState: !!state,
            hasError: !!error,
            expectedState: pendingAuth?.state,
            stateMatches: state === pendingAuth?.state,
          })

          if (error) {
            res.writeHead(200, { "Content-Type": "text/html" })
            res.end(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Authentication Failed</title>
                <style>
                  body { 
                    font-family: system-ui, -apple-system, sans-serif; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    height: 100vh; 
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  }
                  .container {
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    text-align: center;
                  }
                  h1 { color: #e53e3e; }
                  p { color: #4a5568; margin-top: 1rem; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>❌ Authentication Failed</h1>
                  <p>Error: ${error}</p>
                  <p>You can close this window and try again.</p>
                </div>
              </body>
              </html>
            `)
            server?.close()
            reject(new Error(`Authentication failed: ${error}`))
            return
          }

          if (code && state === pendingAuth?.state) {
            console.log("✅ ChatGPT OAuth: Valid callback - sending success response to browser")
            res.writeHead(200, { "Content-Type": "text/html" })
            res.end(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Authentication Successful</title>
                <style>
                  body { 
                    font-family: system-ui, -apple-system, sans-serif; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    height: 100vh; 
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  }
                  .container {
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    text-align: center;
                  }
                  h1 { color: #48bb78; }
                  p { color: #4a5568; margin-top: 1rem; }
                  .logo {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="logo">🤖</div>
                  <h1>Authentication Successful!</h1>
                  <p>You've successfully logged into ChatGPT.</p>
                  <p>You can close this window and return to OpenCode.</p>
                </div>
              </body>
              </html>
            `)
            console.log("🔒 ChatGPT OAuth: Closing callback server")
            server?.close()
            console.log("🎯 ChatGPT OAuth: Resolving promise with authorization code")
            resolve({ code })
          } else {
            res.writeHead(400, { "Content-Type": "text/plain" })
            res.end("Invalid state parameter")
          }
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" })
          res.end("Not found")
        }
      })

      server.listen(1455, "localhost", () => {
        console.log("OAuth callback server listening on http://localhost:1455")
      })

      server.on("error", reject)
    })
  }

  return {
    auth: {
      provider: "chatgpt",
      methods: [
        {
          type: "oauth",
          label: "Login with ChatGPT Plus/Pro",
          async authorize() {
            const { url, state, codeVerifier } = await AuthChatGPT.authorize()
            
            // Set up the callback handler
            console.log("🛠️  ChatGPT OAuth: Setting up callback server...")
            const callbackPromise = createCallbackServer()
            console.log("📡 ChatGPT OAuth: Callback server setup complete, promise created")
            
            pendingAuth = {
              codeVerifier,
              state,
              resolve: () => {},
              reject: () => {},
            }

            return {
              url,
              method: "auto" as const,
              instructions: "Please login to your ChatGPT account in the browser window that just opened.",
              async callback() {
                try {
                  console.log("🚀 ChatGPT OAuth: Starting callback process...")
                  const { code } = await callbackPromise
                  console.log("✅ ChatGPT OAuth: Got authorization code from callback", {
                    codeLength: code.length,
                    codePrefix: code.substring(0, 10) + "...",
                  })
                  
                  console.log("🔐 ChatGPT OAuth: Exchanging authorization code for tokens...")
                  
                  // Exchange code for tokens
                  const tokenData = await AuthChatGPT.exchangeCode(code, codeVerifier)
                  console.log("✅ ChatGPT OAuth: Token exchange successful", {
                    hasRefreshToken: !!tokenData.refresh_token,
                    hasAccessToken: !!tokenData.access_token,
                    hasIdToken: !!tokenData.id_token,
                    accountId: tokenData.account_id,
                    email: tokenData.email,
                  })
                  
                  // Store the tokens using OpenCode's Auth system
                  const { Auth } = await import("../../opencode/src/auth/index")
                  console.log("💾 ChatGPT OAuth: Storing tokens in auth system...")
                  
                  await Auth.set("chatgpt", {
                    type: "oauth",
                    refresh: tokenData.refresh_token,
                    access: tokenData.access_token,
                    expires: Date.now() + (28 * 24 * 60 * 60 * 1000), // 28 days
                  })
                  console.log("✅ ChatGPT OAuth: Main tokens stored successfully")

                  // Store additional metadata (including account_id from access token)
                  const accessPayload = tokenData.access_token.split(".")[1]
                  const accessData = JSON.parse(Buffer.from(accessPayload, "base64").toString())
                  const accountId = accessData?.["https://api.openai.com/auth"]?.chatgpt_account_id
                  
                  await Auth.set("chatgpt-metadata", {
                    type: "api",
                    key: JSON.stringify({
                      account_id: accountId || tokenData.account_id,
                      email: tokenData.email,
                      id_token: tokenData.id_token,
                    }),
                  })
                  console.log("✅ ChatGPT OAuth: Metadata stored successfully")

                  return {
                    type: "success" as const,
                    refresh: tokenData.refresh_token,
                    access: tokenData.access_token,
                    expires: Date.now() + (28 * 24 * 60 * 60 * 1000),
                  }
                } catch (error) {
                  console.error("❌ ChatGPT OAuth: Callback error occurred:", {
                    errorType: error?.constructor?.name,
                    errorMessage: error instanceof Error ? error.message : String(error),
                    errorStack: error instanceof Error ? error.stack : undefined,
                  })
                  return {
                    type: "failed" as const,
                    error: error instanceof Error ? error.message : "Unknown error",
                  }
                } finally {
                  console.log("🧹 ChatGPT OAuth: Cleaning up server and auth state...")
                  server?.close()
                  pendingAuth = null
                }
              },
            }
          },
        },
      ],
    },
  }
}) as Plugin