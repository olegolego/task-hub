import { create } from 'zustand'
import { ipc } from '../utils/ipc'

/** Client-side group chat message (camelCase from server mapping) */
export interface GroupChatMessage {
  id: string
  groupId: string
  fromUserId: string
  body: string
  createdAt: string
  displayName?: string
  avatarColor?: string
  fromName?: string
  fromColor?: string
}

interface GroupChatStoreState {
  messagesByGroup: Record<string, GroupChatMessage[]>
  unreadByGroup: Record<string, number>
  activeGroupId: string | null
}

interface GroupChatStoreActions {
  setActiveGroup: (groupId: string | null) => void
  setHistory: (groupId: string, messages: GroupChatMessage[]) => void
  addMessage: (message: GroupChatMessage) => void
  totalUnread: () => number
  loadHistory: (groupId: string) => void
  sendMessage: (groupId: string, body: string) => void
}

export const useGroupChatStore = create<GroupChatStoreState & GroupChatStoreActions>()(
  (set, get) => ({
    messagesByGroup: {}, // groupId → Message[]
    unreadByGroup: {}, // groupId → number
    activeGroupId: null, // which group's chat is currently open/visible

    setActiveGroup: (groupId) => {
      set((s) => ({
        activeGroupId: groupId,
        unreadByGroup: groupId ? { ...s.unreadByGroup, [groupId]: 0 } : s.unreadByGroup,
      }))
    },

    setHistory: (groupId, messages) =>
      set((s) => ({
        messagesByGroup: { ...s.messagesByGroup, [groupId]: messages },
        // Clear unread when history loads (user is viewing this chat)
        unreadByGroup: { ...s.unreadByGroup, [groupId]: 0 },
      })),

    addMessage: (message) =>
      set((s) => {
        const existing = s.messagesByGroup[message.groupId] ?? []
        if (existing.some((m) => m.id === message.id)) return s

        const isActive = s.activeGroupId === message.groupId
        const newUnread = isActive
          ? s.unreadByGroup
          : { ...s.unreadByGroup, [message.groupId]: (s.unreadByGroup[message.groupId] ?? 0) + 1 }

        return {
          messagesByGroup: { ...s.messagesByGroup, [message.groupId]: [...existing, message] },
          unreadByGroup: newUnread,
        }
      }),

    totalUnread: () => Object.values(get().unreadByGroup).reduce((a, b) => a + b, 0),

    loadHistory: (groupId) => {
      ipc.sendMessage({ type: 'group:history', payload: { groupId } })
    },

    sendMessage: (groupId, body) => {
      if (!body.trim()) return
      ipc.sendMessage({ type: 'group:message', payload: { groupId, body } })
    },
  }),
)
