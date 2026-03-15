import { create } from 'zustand'
import { ipc } from '../utils/ipc'

export const useGroupChatStore = create((set, get) => ({
  messagesByGroup: {}, // groupId → Message[]

  setHistory: (groupId, messages) => set((s) => ({
    messagesByGroup: { ...s.messagesByGroup, [groupId]: messages },
  })),

  addMessage: (message) => set((s) => {
    const existing = s.messagesByGroup[message.groupId] ?? []
    if (existing.some(m => m.id === message.id)) return s
    return { messagesByGroup: { ...s.messagesByGroup, [message.groupId]: [...existing, message] } }
  }),

  loadHistory: (groupId) => {
    ipc.sendMessage({ type: 'group:history', payload: { groupId } })
  },

  sendMessage: (groupId, body) => {
    if (!body.trim()) return
    ipc.sendMessage({ type: 'group:message', payload: { groupId, body } })
  },
}))
