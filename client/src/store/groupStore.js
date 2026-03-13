import { create } from 'zustand'
import { ipc } from '../utils/ipc'

export const useGroupStore = create((set, get) => ({
  groups: [],
  activeGroupId: null,

  setGroups: (groups) => set({ groups }),
  setActiveGroupId: (id) => set({ activeGroupId: id }),

  addGroupFromServer: (group) => set((s) => ({
    groups: [group, ...s.groups.filter(g => g.id !== group.id)],
  })),

  handleMemberJoined: ({ groupId, userId, displayName }) => {
    // Could update member counts or a members list in future
    console.log(`[Groups] ${displayName} joined group ${groupId}`)
  },

  handleMemberLeft: ({ groupId, userId }) => {
    console.log(`[Groups] User ${userId} left group ${groupId}`)
  },

  createGroup: (name, description = '') => {
    ipc.sendMessage({ type: 'group:create', payload: { name, description } })
  },

  joinGroup: (groupId) => {
    ipc.sendMessage({ type: 'group:join', payload: { groupId } })
  },

  leaveGroup: (groupId) => {
    ipc.sendMessage({ type: 'group:leave', payload: { groupId } })
    set((s) => ({ groups: s.groups.filter(g => g.id !== groupId) }))
  },
}))
