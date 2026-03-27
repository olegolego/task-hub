export interface LLMChat {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface LLMMessage {
  id: string
  chat_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}
