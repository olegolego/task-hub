import { create } from 'zustand'
import type { User } from '@task-hub/shared'

interface UserStoreState {
  users: User[]
  onlineIds: string[]
  pendingUsers: User[]
}

interface UserStoreActions {
  setUsers: (users: User[]) => void
  setOnlineUsers: (onlineIds: string[]) => void
  setPendingUsers: (pendingUsers: User[]) => void
  addPendingUser: (user: User) => void
  removePendingUser: (userId: string) => void
  addUser: (user: User) => void
  setUserOnline: (userId: string) => void
  setUserOffline: (userId: string) => void
  getUserById: (id: string) => User | undefined
  isOnline: (userId: string) => boolean
  getOnlineUsers: () => User[]
  getOfflineUsers: () => User[]
}

export const useUserStore = create<UserStoreState & UserStoreActions>()((set, get) => ({
  users: [], // all known active users
  onlineIds: [], // currently online user IDs
  pendingUsers: [], // users awaiting admin approval

  setUsers: (users) => set({ users }),
  setOnlineUsers: (onlineIds) => set({ onlineIds }),
  setPendingUsers: (pendingUsers) => set({ pendingUsers }),

  addPendingUser: (user) =>
    set((s) => ({
      pendingUsers: s.pendingUsers.some((u) => u.id === user.id)
        ? s.pendingUsers
        : [...s.pendingUsers, user],
    })),

  removePendingUser: (userId) =>
    set((s) => ({
      pendingUsers: s.pendingUsers.filter((u) => u.id !== userId),
    })),

  addUser: (user) =>
    set((s) => ({
      users: s.users.some((u) => u.id === user.id) ? s.users : [...s.users, user],
    })),

  setUserOnline: (userId) =>
    set((s) => ({
      onlineIds: s.onlineIds.includes(userId) ? s.onlineIds : [...s.onlineIds, userId],
    })),

  setUserOffline: (userId) =>
    set((s) => ({
      onlineIds: s.onlineIds.filter((id) => id !== userId),
    })),

  getUserById: (id) => get().users.find((u) => u.id === id),

  isOnline: (userId) => get().onlineIds.includes(userId),

  getOnlineUsers: () => {
    const { users, onlineIds } = get()
    return users.filter((u) => onlineIds.includes(u.id))
  },

  getOfflineUsers: () => {
    const { users, onlineIds } = get()
    return users.filter((u) => !onlineIds.includes(u.id))
  },
}))
