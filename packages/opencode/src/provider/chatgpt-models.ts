// ChatGPT Plus/Pro models configuration (aligned with Codex)
export const CHATGPT_MODELS = {
  provider: {
    id: "chatgpt",
    name: "ChatGPT Plus/Pro",
    npm: null, // Uses custom SDK
    env: [], // Uses OAuth, no env vars
    api: "https://chatgpt.com/backend-api",
    models: {
      "gpt-5": {
        id: "gpt-5",
        name: "GPT-5",
        release_date: "2025-08-07",
        attachment: true,
        reasoning: true, // GPT-5 supports reasoning with effort levels
        temperature: true,
        tool_call: true,
        cost: {
          input: 0,
          output: 0,
          cache_read: 0,
          cache_write: 0,
        },
        options: {
          supports_reasoning_summaries: true,
          reasoning_efforts: ["minimal", "low", "medium", "high"],
        },
        limit: {
          context: 200000,
          output: 65536,
        },
      },
    },
  },
}

// Function to register ChatGPT models with OpenCode
export function registerChatGPTModels(database: any) {
  if (!database.chatgpt) {
    database.chatgpt = CHATGPT_MODELS.provider
  } else {
    // Merge models if provider exists
    database.chatgpt.models = {
      ...database.chatgpt.models,
      ...CHATGPT_MODELS.provider.models,
    }
  }
  return database
}