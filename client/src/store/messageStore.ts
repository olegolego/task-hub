// @ts-nocheck
import { create } from 'zustand'
import { ipc } from '../utils/ipc'
import { useConnectionStore } from './connectionStore'

export const useMessageStore = create((set, get) => ({
  // Map of userId → Message[]
  threads: {},
  // Which user's thread is open
  activeThreadUserId: null,
  // Unread counts per userId
  unreadCounts: {},

  setActiveThread: (userId) => {
    set((s) => ({
      activeThreadUserId: userId,
      unreadCounts: userId ? { ...s.unreadCounts, [userId]: 0 } : s.unreadCounts,
    }))
    if (userId) ipc.loadDMHistory(userId)
  },

  // Called when server delivers dm:history_response
  setHistory: (withUserId, messages) => {
    set((s) => ({
      threads: { ...s.threads, [withUserId]: messages },
    }))
  },

  // Called when a DM is received (sent or received)
  addMessage: (dm) => {
    const { activeThreadUserId } = get()
    const myId = useConnectionStore.getState().myUserId
    // The conversation partner is the other party
    const partnerId = dm.fromUserId === myId ? dm.toUserId : dm.fromUserId

    set((s) => {
      const thread = s.threads[partnerId] ?? []
      // Deduplicate by id
      if (thread.some((m) => m.id === dm.id)) return s

      const newUnread =
        partnerId !== activeThreadUserId && dm.fromUserId !== myId && myId !== null
          ? { ...s.unreadCounts, [partnerId]: (s.unreadCounts[partnerId] ?? 0) + 1 }
          : s.unreadCounts

      return {
        threads: { ...s.threads, [partnerId]: [...thread, dm] },
        unreadCounts: newUnread,
      }
    })
  },

  sendMessage: async (toUserId, text) => {
    if (!text.trim()) return
    return ipc.sendDM(toUserId, text.trim())
  },

  deleteMessage: (dmId) => {
    ipc.sendMessage({ type: 'dm:delete', payload: { dmId } })
  },

  editMessage: (dmId, newText, toUserId) => {
    return ipc.editDM(dmId, newText.trim(), toUserId)
  },

  markEdited: (dmId, newText) =>
    set((s) => {
      const newThreads = {}
      for (const [uid, msgs] of Object.entries(s.threads)) {
        newThreads[uid] = msgs.map((m) =>
          m.id === dmId ? { ...m, text: newText, editedAt: new Date().toISOString() } : m,
        )
      }
      return { threads: newThreads }
    }),

  markDeleted: (dmId) =>
    set((s) => {
      const newThreads = {}
      for (const [uid, msgs] of Object.entries(s.threads)) {
        newThreads[uid] = msgs.map((m) =>
          m.id === dmId ? { ...m, deletedAt: new Date().toISOString() } : m,
        )
      }
      return { threads: newThreads }
    }),

  setReactions: (dmId, reactions) =>
    set((s) => {
      const newThreads = {}
      for (const [uid, msgs] of Object.entries(s.threads)) {
        newThreads[uid] = msgs.map((m) => (m.id === dmId ? { ...m, reactions } : m))
      }
      return { threads: newThreads }
    }),

  reactToMessage: (dmId, emoji) => {
    ipc.sendMessage({ type: 'dm:react', payload: { dmId, emoji } })
  },

  totalUnread: () => Object.values(get().unreadCounts).reduce((a, b) => a + b, 0),
}))
