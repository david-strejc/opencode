# OpenCode ChatGPT Authentication Plugin

This plugin provides OAuth authentication for ChatGPT Plus/Pro accounts in OpenCode, enabling access to the ChatGPT backend API (not the standard OpenAI API).

## Features

- OAuth 2.0 authentication flow with PKCE
- Automatic token refresh (28-day cycle)
- Access to ChatGPT backend API endpoints
- Secure token storage using OpenCode's auth system
- Account metadata storage (account ID, email)

## Installation

The plugin is automatically loaded by OpenCode unless disabled via the `OPENCODE_DISABLE_DEFAULT_PLUGINS` flag.

## Usage

### Authentication

To authenticate with ChatGPT:

```bash
opencode auth login
# Select "chatgpt" from the provider list
# Follow the browser authentication flow
```

### API Access

Once authenticated, the plugin provides access to ChatGPT backend API through the `ChatGPTProvider`:

```typescript
import { ChatGPTProvider } from "../provider/chatgpt"

// Get account information
const account = await ChatGPTProvider.getAccountInfo()

// Get available models
const models = await ChatGPTProvider.getModels()

// Start a conversation
const response = await ChatGPTProvider.startConversation(
  "Hello, ChatGPT!",
  "gpt-4"
)

// Continue a conversation
const continued = await ChatGPTProvider.continueConversation(
  response.conversation_id,
  response.message.id,
  "Tell me more",
  "gpt-4"
)
```

## Authentication Flow

1. **Authorization**: Generates OAuth URL with PKCE challenge
2. **Browser Login**: User authenticates via auth.openai.com
3. **Callback**: Local server (port 51234) receives authorization code
4. **Token Exchange**: Code exchanged for access/refresh tokens
5. **Storage**: Tokens stored securely in OpenCode's auth system
6. **Refresh**: Automatic token refresh every 28 days

## API Endpoints

The plugin provides access to ChatGPT backend API endpoints:

- `/models` - Get available models
- `/conversation` - Start new conversations
- `/conversation/{id}` - Continue/get conversations
- `/conversations` - List conversations
- `/accounts/check` - Get account information

## Security

- Uses PKCE (Proof Key for Code Exchange) for enhanced OAuth security
- Tokens stored with restricted file permissions (0600)
- Automatic token refresh to maintain access
- Account ID included in API requests for proper authorization

## Configuration

The plugin uses the following constants:

- **Client ID**: `app_EMoamEEZ73f0CkXaXp7hrann`
- **OAuth Issuer**: `https://auth.openai.com`
- **Backend API**: `https://chatgpt.com/backend-api`
- **Callback Port**: `51234`

## Token Storage

Tokens are stored in two locations:

1. **OAuth Tokens**: `~/.opencode/auth.json` under key "chatgpt"
2. **Metadata**: `~/.opencode/auth.json` under key "chatgpt-metadata"

## Troubleshooting

### Authentication Failed
- Ensure you have a valid ChatGPT Plus/Pro subscription
- Check that port 51234 is available for the callback server
- Try logging out and logging in again: `opencode auth logout` then `opencode auth login`

### Token Refresh Failed
- The plugin automatically refreshes tokens every 28 days
- If refresh fails, re-authenticate using `opencode auth login`

### API Access Denied
- Verify your ChatGPT subscription is active
- Check that the account ID is properly stored and sent with requests
- Ensure tokens haven't been manually modified or corrupted

## Development

To modify or extend the plugin:

1. Edit source files in `src/`
2. Build: `bun build ./src/index.ts --outdir ./dist --target node`
3. Test: Run `bun test-chatgpt-auth.ts` from the opencode root

## License

Part of the OpenCode project. See main LICENSE file for details.