# OpenCode Build Instructions

## Prerequisites
- Bun (JavaScript runtime and bundler)
- Go (for building the TUI)
- Node.js (for npm packages)

## Building OpenCode

### Complete Build Process (All Components)

```bash
# 1. Navigate to the OpenCode directory
cd /home/david/Work/Programming/coders/opencode

# 2. Install dependencies
bun install

# 3. Build the Go TUI component first
cd packages/tui
go build -o tui ./cmd/opencode/main.go
cd ../..

# 4. Build and compile OpenCode with embedded TUI
bun build packages/opencode/src/index.ts --compile --embed packages/tui/tui --outfile opencode

# 5. Install the binary
mv opencode ~/.opencode/bin/
chmod +x ~/.opencode/bin/opencode
```

### Quick Rebuild (After Code Changes)

```bash
# One-liner for quick rebuild and install
bun build packages/opencode/src/index.ts --compile --embed packages/tui/tui --outfile opencode && mv opencode ~/.opencode/bin/
```

### Building TUI Only

```bash
cd packages/tui
go build -o tui ./cmd/opencode/main.go
```

## Testing

### Test CLI
```bash
~/.opencode/bin/opencode run "What is 2+2?" -m chatgpt/gpt-5
```

### Test TUI
```bash
~/.opencode/bin/opencode -m chatgpt/gpt-5
```

## Important Files Modified for ChatGPT Integration

1. **Authentication**: `/packages/opencode/src/auth/chatgpt.ts`
   - OAuth 2.0 with PKCE implementation
   - Token refresh logic

2. **Provider SDK**: `/packages/opencode/src/provider/chatgpt-sdk.ts`
   - Custom SDK for ChatGPT backend API
   - Streaming response handling
   - Message format conversion (input_text/output_text)

3. **Models Configuration**: `/packages/opencode/src/provider/chatgpt-models.ts`
   - GPT-5 model definition
   - Reasoning effort support

4. **Provider Registration**: `/packages/opencode/src/provider/chatgpt-provider.ts`
   - Provider initialization
   - SDK instantiation

## Known Issues and Fixes

### Issue: "Invalid value: 'input_text'" error
**Fix**: Modified `chatgpt-sdk.ts` to:
- Use `output_text` for assistant messages
- Use `input_text` for user messages  
- Filter out system messages (handled via instructions)

### Issue: Build errors with zod-openapi
**Fix**: Added `import "zod-openapi/extend"` at top of auth files

### Issue: ChatGPT not using tools (can't create files, etc.)
**Fix**: Modified `chatgpt-sdk.ts` to:
- Pass tools from options instead of hardcoded empty array
- Added `convertToolsToCodexFormat` method to convert AI SDK tools to Codex format  
- Added tool call event handling in streaming response

## Running Lint and Typecheck

```bash
# Run from project root
bun run typecheck  # If available
# Or check package.json for available scripts
```

## Configuration

### ChatGPT Authentication
Authentication tokens are stored in:
```
~/.local/share/opencode/auth.json
```

### MCP Servers Configuration
Create config at one of:
- `~/Work/Programming/coders/opencode/opencode.json`
- `~/.config/opencode/config.json`

Example:
```json
{
  "mcp": {
    "zen": {
      "type": "local",
      "command": ["python", "/path/to/zen-mcp-server/server.py"],
      "environment": {
        "GEMINI_API_KEY": "your-key"
      }
    }
  }
}
```

## Development Tips

1. **Watch Logs**: `tail -f ~/.local/share/opencode/log/dev.log`
2. **Clear Auth**: `rm ~/.local/share/opencode/auth.json` (forces re-login)
3. **Test Sessions**: Use `--session <id>` flag for multi-turn conversations
4. **Debug Mode**: Add `--print-logs` flag for verbose output

## Changelog

### 2025-08-18
- Fixed ChatGPT message format (input_text vs output_text)
- Added system message filtering
- Integrated OAuth authentication with PKCE
- Added GPT-5 model support with reasoning