import { create } from 'zustand'
import { ipc } from '../utils/ipc'
import type { Group } from '@task-hub/shared'
import { useTaskStore } from './taskStore'

/** Member as represented in the client (display info included) */
export interface GroupMemberClient {
  id: string
  display_name: string
  avatar_color?: string | null
  role: string
}

/** Pending invite the current user received */
export interface PendingInvite {
  inviteId: string
  groupId: string
  groupName: string
  groupColor?: string | null
  fromId?: string
  fromName?: string
  inviterId?: string
  inviterName?: string
}

/** Join request awaiting admin approval */
interface PendingJoinRequest {
  inviteId: string
  groupId: string
  groupName: string
  requesterId: string
  requesterName: string
  requesterColor?: string | null
}

interface GroupStoreState {
  groups: Group[]
  activeGroupId: string | null
  membersByGroup: Record<string, GroupMemberClient[]>
  pendingInvites: PendingInvite[]
  pendingJoinRequests: PendingJoinRequest[]
}

interface GroupStoreActions {
  setGroups: (groups: Group[]) => void
  setActiveGroupId: (id: string | null) => void
  setPendingInvites: (pendingInvites: PendingInvite[]) => void
  setPendingJoinRequests: (pendingJoinRequests: PendingJoinRequest[]) => void
  addPendingInvite: (invite: PendingInvite) => void
  removePendingInvite: (inviteId: string) => void
  addPendingJoinRequest: (req: PendingJoinRequest) => void
  removePendingJoinRequest: (inviteId: string) => void
  respondToInvite: (inviteId: string, accept: boolean) => void
  respondToJoinRequest: (inviteId: string, accept: boolean) => void
  addGroupFromServer: (group: Group) => void
  setGroupMembers: (groupId: string, members: GroupMemberClient[]) => void
  handleMemberJoined: (payload: Record<string, any>) => void
  handleMemberLeft: (payload: Record<string, any>) => void
  handleInvited: (payload: Record<string, any>) => void
  createGroup: (name: string, description?: string) => void
  joinGroup: (groupId: string) => void
  inviteUser: (groupId: string, userId: string) => void
  fetchMembers: (groupId: string) => void
  leaveGroup: (groupId: string) => void
}

export const useGroupStore = create<GroupStoreState & GroupStoreActions>()((set, _get) => ({
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

  handleMemberJoined: ({ groupId, userId: _userId, displayName }) => {
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
