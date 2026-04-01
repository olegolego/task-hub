import { create } from 'zustand'
import { ipc } from '../utils/ipc'
import { useConnectionStore } from './connectionStore'

/** Decrypted DM as used in the client (text instead of encrypted/nonce) */
export interface DecryptedDM {
  id: string
  fromUserId: string
  toUserId: string
  text: string
  createdAt: string
  deletedAt?: string | null
  editedAt?: string | null
  fileId?: string | null
  fileName?: string | null
  fileSize?: number | null
  mimeType?: string | null
}

interface MessageStoreState {
  threads: Record<string, DecryptedDM[]>
  activeThreadUserId: string | null
  unreadCounts: Record<string, number>
}

interface MessageStoreActions {
  setActiveThread: (userId: string | null) => void
  setHistory: (withUserId: string, messages: DecryptedDM[]) => void
  addMessage: (dm: DecryptedDM) => void
  sendMessage: (
    toUserId: string,
    text: string,
  ) => Promise<{ ok: boolean; error?: string } | { ok: false } | void>
  deleteMessage: (dmId: string) => void
  editMessage: (
    dmId: string,
    newText: string,
    toUserId: string,
  ) => Promise<{ ok: boolean; error?: string } | { ok: false } | void>
  markEdited: (dmId: string, newText: string) => void
  markDeleted: (dmId: string) => void
  totalUnread: () => number
}

export const useMessageStore = create<MessageStoreState & MessageStoreActions>()((set, get) => ({
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
      const newThreads: Record<string, DecryptedDM[]> = {}
      for (const [uid, msgs] of Object.entries(s.threads)) {
        newThreads[uid] = msgs.map((m) =>
          m.id === dmId ? { ...m, text: newText, editedAt: new Date().toISOString() } : m,
        )
      }
      return { threads: newThreads }
    }),

  markDeleted: (dmId) =>
    set((s) => {
      const newThreads: Record<string, DecryptedDM[]> = {}
      for (const [uid, msgs] of Object.entries(s.threads)) {
        newThreads[uid] = msgs.map((m) =>
          m.id === dmId ? { ...m, deletedAt: new Date().toISOString() } : m,
        )
      }
      return { threads: newThreads }
    }),

  totalUnread: () => Object.values(get().unreadCounts).reduce((a, b) => a + b, 0),
}))
