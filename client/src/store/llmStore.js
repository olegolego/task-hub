import { create } from 'zustand'
import { ipc } from '../utils/ipc'

export const useLLMStore = create((set, get) => ({
  // Chat list
  chats: [],
  activeChatId: null,

  // Messages per chat
  messagesByChat: {},

  // Loading states
  thinking: false,     // waiting for LLM response
  loadingHistory: false,

  // LLM server status
  llmStatus: 'unknown', // 'unknown' | 'online' | 'offline'
  llmModel: null,

  // Error for current operation
  lastError: null,

  // ── Chat list ─────────────────────────────────────────────────────────────

  setChats: (chats) => set({ chats }),

  addChat: (chat) => set((s) => ({
    chats: [chat, ...s.chats.filter(c => c.id !== chat.id)],
  })),

  removeChat: (chatId) => set((s) => ({
    chats: s.chats.filter(c => c.id !== chatId),
    activeChatId: s.activeChatId === chatId ? (s.chats.find(c => c.id !== chatId)?.id ?? null) : s.activeChatId,
  })),

  // ── Messages ──────────────────────────────────────────────────────────────

  setMessages: (chatId, messages) => set((s) => ({
    messagesByChat: { ...s.messagesByChat, [chatId]: messages },
  })),

  addMessage: (chatId, message) => set((s) => {
    const existing = s.messagesByChat[chatId] || []
    return {
      messagesByChat: { ...s.messagesByChat, [chatId]: [...existing, message] },
    }
  }),

  // ── Status ────────────────────────────────────────────────────────────────

  setStatus: (status, model) => set({ llmStatus: status, llmModel: model }),
  setThinking: (thinking) => set({ thinking, lastError: thinking ? null : get().lastError }),
  setError: (error) => set({ lastError: error, thinking: false }),

  // ── Actions (IPC) ─────────────────────────────────────────────────────────

  checkStatus: () => {
    ipc.sendMessage({ type: 'llm:status' })
  },

  loadChats: () => {
    ipc.sendMessage({ type: 'llm:chat_list' })
  },

  newChat: () => {
    ipc.sendMessage({ type: 'llm:chat_new' })
  },

  loadHistory: (chatId) => {
    set({ loadingHistory: true })
    ipc.sendMessage({ type: 'llm:chat_history', payload: { chatId } })
  },

  selectChat: (chatId) => {
    set({ activeChatId: chatId, lastError: null })
    if (chatId) {
      const existing = get().messagesByChat[chatId]
      if (!existing) get().loadHistory(chatId)
    }
  },

  sendMessage: (text, useCompanyData = false) => {
    const { activeChatId } = get()
    if (!text.trim()) return
    set({ thinking: true, lastError: null })
    ipc.sendMessage({
      type: 'llm:chat',
      payload: {
        message: text.trim(),
        chatId: activeChatId || undefined,
        useCompanyData,
      },
    })
  },

  deleteChat: (chatId) => {
    ipc.sendMessage({ type: 'llm:chat_delete', payload: { chatId } })
  },
}))
