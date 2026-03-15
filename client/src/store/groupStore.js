import { create } from 'zustand'
import { ipc } from '../utils/ipc'

export const useGroupStore = create((set, get) => ({
  groups: [],
  activeGroupId: null,
  // groupId → [{ id, display_name, avatar_color, role }]
  membersByGroup: {},

  setGroups: (groups) => set({ groups }),
  setActiveGroupId: (id) => set({ activeGroupId: id }),

  addGroupFromServer: (group) => set((s) => ({
    groups: [group, ...s.groups.filter(g => g.id !== group.id)],
  })),

  setGroupMembers: (groupId, members) => set((s) => ({
    membersByGroup: { ...s.membersByGroup, [groupId]: members },
  })),

  handleMemberJoined: ({ groupId, userId, displayName }) => {
    console.log(`[Groups] ${displayName} joined group ${groupId}`)
    // Request updated member list
    ipc.sendMessage({ type: 'group:members', payload: { groupId } })
  },

  handleMemberLeft: ({ groupId, userId }) => {
    set((s) => {
      const members = s.membersByGroup[groupId]?.filter(m => m.id !== userId) ?? []
      return { membersByGroup: { ...s.membersByGroup, [groupId]: members } }
    })
  },

  handleInvited: ({ group, tasks, members }) => {
    set((s) => ({
      groups: [group, ...s.groups.filter(g => g.id !== group.id)],
      membersByGroup: { ...s.membersByGroup, [group.id]: members },
    }))
    // Also load tasks into taskStore
    const { useTaskStore } = require('./taskStore')
    for (const task of tasks || []) {
      useTaskStore.getState().addTaskFromServer(task)
    }
  },

  createGroup: (name, description = '') => {
    ipc.sendMessage({ type: 'group:create', payload: { name, description } })
  },

  joinGroup: (groupId) => {
    ipc.sendMessage({ type: 'group:join', payload: { groupId } })
  },

  inviteUser: (groupId, userId) => {
    ipc.sendMessage({ type: 'group:invite', payload: { groupId, userId } })
  },

  fetchMembers: (groupId) => {
    ipc.sendMessage({ type: 'group:members', payload: { groupId } })
  },

  leaveGroup: (groupId) => {
    ipc.sendMessage({ type: 'group:leave', payload: { groupId } })
    set((s) => ({
      groups: s.groups.filter(g => g.id !== groupId),
      membersByGroup: Object.fromEntries(
        Object.entries(s.membersByGroup).filter(([id]) => id !== groupId)
      ),
    }))
  },
}))
