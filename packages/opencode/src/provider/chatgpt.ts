import { AuthChatGPT } from "../auth/chatgpt"

export namespace ChatGPTProvider {
  // ChatGPT Backend API endpoints
  const BACKEND_API_URL = "https://chatgpt.com/backend-api"
  
  export interface ConversationRequest {
    action: string
    messages: Array<{
      id: string
      author: { role: string }
      content: { content_type: string; parts: string[] }
    }>
    model: string
    parent_message_id: string
    timezone_offset_min?: number
  }

  export interface ConversationResponse {
    message: {
      id: string
      author: { role: string }
      content: { content_type: string; parts: string[] }
      status: string
      end_turn: boolean
    }
    conversation_id: string
    error?: string
  }

  // Get available models for the authenticated user
  export async function getModels() {
    try {
      const response = await AuthChatGPT.makeRequest<{ models: any[] }>("/models")
      return response.models
    } catch (error) {
      console.error("Failed to fetch ChatGPT models:", error)
      return []
    }
  }

  // Start a new conversation
  export async function startConversation(prompt: string, model: string = "gpt-4") {
    const request: ConversationRequest = {
      action: "next",
      messages: [
        {
          id: crypto.randomUUID(),
          author: { role: "user" },
          content: {
            content_type: "text",
            parts: [prompt],
          },
        },
      ],
      model,
      parent_message_id: crypto.randomUUID(),
      timezone_offset_min: new Date().getTimezoneOffset(),
    }

    try {
      const response = await AuthChatGPT.makeRequest<ConversationResponse>(
        "/conversation",
        {
          method: "POST",
          body: JSON.stringify(request),
        }
      )
      return response
    } catch (error) {
      console.error("Failed to start ChatGPT conversation:", error)
      throw error
    }
  }

  // Continue an existing conversation
  export async function continueConversation(
    conversationId: string,
    parentMessageId: string,
    prompt: string,
    model: string = "gpt-4"
  ) {
    const request: ConversationRequest = {
      action: "next",
      messages: [
        {
          id: crypto.randomUUID(),
          author: { role: "user" },
          content: {
            content_type: "text",
            parts: [prompt],
          },
        },
      ],
      model,
      parent_message_id: parentMessageId,
      timezone_offset_min: new Date().getTimezoneOffset(),
    }

    try {
      const response = await AuthChatGPT.makeRequest<ConversationResponse>(
        `/conversation/${conversationId}`,
        {
          method: "POST",
          body: JSON.stringify(request),
        }
      )
      return response
    } catch (error) {
      console.error("Failed to continue ChatGPT conversation:", error)
      throw error
    }
  }

  // Get conversation history
  export async function getConversations(offset: number = 0, limit: number = 20) {
    try {
      const response = await AuthChatGPT.makeRequest<{ items: any[] }>(
        `/conversations?offset=${offset}&limit=${limit}`
      )
      return response.items
    } catch (error) {
      console.error("Failed to fetch ChatGPT conversations:", error)
      return []
    }
  }

  // Get specific conversation
  export async function getConversation(conversationId: string) {
    try {
      const response = await AuthChatGPT.makeRequest(
        `/conversation/${conversationId}`
      )
      return response
    } catch (error) {
      console.error("Failed to fetch ChatGPT conversation:", error)
      throw error
    }
  }

  // Delete a conversation
  export async function deleteConversation(conversationId: string) {
    try {
      await AuthChatGPT.makeRequest(
        `/conversation/${conversationId}`,
        {
          method: "DELETE",
        }
      )
      return true
    } catch (error) {
      console.error("Failed to delete ChatGPT conversation:", error)
      return false
    }
  }

  // Get user account information
  export async function getAccountInfo() {
    try {
      const response = await AuthChatGPT.makeRequest("/accounts/check")
      return response
    } catch (error) {
      console.error("Failed to fetch ChatGPT account info:", error)
      return null
    }
  }
}