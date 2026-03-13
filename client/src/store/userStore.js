import { create } from 'zustand'

export const useUserStore = create((set, get) => ({
  users: [],        // all known active users
  onlineIds: [],    // currently online user IDs
  pendingUsers: [], // users awaiting admin approval

  setUsers: (users) => set({ users }),
  setOnlineUsers: (onlineIds) => set({ onlineIds }),
  setPendingUsers: (pendingUsers) => set({ pendingUsers }),

  addPendingUser: (user) => set((s) => ({
    pendingUsers: s.pendingUsers.some(u => u.id === user.id) ? s.pendingUsers : [...s.pendingUsers, user],
  })),

  removePendingUser: (userId) => set((s) => ({
    pendingUsers: s.pendingUsers.filter(u => u.id !== userId),
  })),

  setUserOnline: (userId) => set((s) => ({
    onlineIds: s.onlineIds.includes(userId) ? s.onlineIds : [...s.onlineIds, userId],
  })),

  setUserOffline: (userId) => set((s) => ({
    onlineIds: s.onlineIds.filter(id => id !== userId),
  })),

  getUserById: (id) => get().users.find(u => u.id === id),

  isOnline: (userId) => get().onlineIds.includes(userId),

  getOnlineUsers: () => {
    const { users, onlineIds } = get()
    return users.filter(u => onlineIds.includes(u.id))
  },

  getOfflineUsers: () => {
    const { users, onlineIds } = get()
    return users.filter(u => !onlineIds.includes(u.id))
  },
}))
