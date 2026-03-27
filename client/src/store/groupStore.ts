// @ts-nocheck
import { create } from 'zustand'
import { ipc } from '../utils/ipc'

export const useGroupStore = create((set, get) => ({
  groups: [],
  activeGroupId: null,
  // groupId → [{ id, display_name, avatar_color, role }]
  membersByGroup: {},
  // Invites this user received (must accept/decline)
  pendingInvites: [],
  // Join requests pending admin approval: { inviteId, groupId, groupName, requesterId, requesterName, requesterColor }[]
  pendingJoinRequests: [],

  setGroups: (groups) => set({ groups }),
  setActiveGroupId: (id) => set({ activeGroupId: id }),

  setPendingInvites: (pendingInvites) => set({ pendingInvites }),
  setPendingJoinRequests: (pendingJoinRequests) => set({ pendingJoinRequests }),

  addPendingInvite: (invite) =>
    set((s) => ({
      pendingInvites: s.pendingInvites.some((i) => i.inviteId === invite.inviteId)
        ? s.pendingInvites
        : [...s.pendingInvites, invite],
    })),

  removePendingInvite: (inviteId) =>
    set((s) => ({
      pendingInvites: s.pendingInvites.filter((i) => i.inviteId !== inviteId),
    })),

  addPendingJoinRequest: (req) =>
    set((s) => ({
      pendingJoinRequests: s.pendingJoinRequests.some((r) => r.inviteId === req.inviteId)
        ? s.pendingJoinRequests
        : [...s.pendingJoinRequests, req],
    })),

  removePendingJoinRequest: (inviteId) =>
    set((s) => ({
      pendingJoinRequests: s.pendingJoinRequests.filter((r) => r.inviteId !== inviteId),
    })),

  respondToInvite: (inviteId, accept) => {
    ipc.sendMessage({ type: 'group:invite_respond', payload: { inviteId, accept } })
    set((s) => ({ pendingInvites: s.pendingInvites.filter((i) => i.inviteId !== inviteId) }))
  },

  respondToJoinRequest: (inviteId, accept) => {
    ipc.sendMessage({ type: 'group:join_respond', payload: { inviteId, accept } })
    set((s) => ({
      pendingJoinRequests: s.pendingJoinRequests.filter((r) => r.inviteId !== inviteId),
    }))
  },

  addGroupFromServer: (group) =>
    set((s) => ({
      groups: [group, ...s.groups.filter((g) => g.id !== group.id)],
    })),

  setGroupMembers: (groupId, members) =>
    set((s) => ({
      membersByGroup: { ...s.membersByGroup, [groupId]: members },
    })),

  handleMemberJoined: ({ groupId, userId, displayName }) => {
    console.log(`[Groups] ${displayName} joined group ${groupId}`)
    // Request updated member list
    ipc.sendMessage({ type: 'group:members', payload: { groupId } })
  },

  handleMemberLeft: ({ groupId, userId }) => {
    set((s) => {
      const members = s.membersByGroup[groupId]?.filter((m) => m.id !== userId) ?? []
      return { membersByGroup: { ...s.membersByGroup, [groupId]: members } }
    })
  },

  handleInvited: ({ group, tasks, members }) => {
    set((s) => ({
      groups: [group, ...s.groups.filter((g) => g.id !== group.id)],
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
      groups: s.groups.filter((g) => g.id !== groupId),
      membersByGroup: Object.fromEntries(
        Object.entries(s.membersByGroup).filter(([id]) => id !== groupId),
      ),
    }))
  },
}))
