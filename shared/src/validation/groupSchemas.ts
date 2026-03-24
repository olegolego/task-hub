import { z } from 'zod'

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

export const inviteToGroupSchema = z.object({
  groupId: z.string(),
  userId: z.string(),
})

export const respondToInviteSchema = z.object({
  inviteId: z.string(),
  accept: z.boolean(),
})

export const respondToJoinSchema = z.object({
  inviteId: z.string(),
  accept: z.boolean(),
})

export const joinGroupSchema = z.object({
  groupId: z.string(),
})

export const leaveGroupSchema = z.object({
  groupId: z.string(),
})

export type CreateGroupPayload = z.infer<typeof createGroupSchema>
export type InviteToGroupPayload = z.infer<typeof inviteToGroupSchema>
export type RespondToInvitePayload = z.infer<typeof respondToInviteSchema>
export type RespondToJoinPayload = z.infer<typeof respondToJoinSchema>
export type JoinGroupPayload = z.infer<typeof joinGroupSchema>
export type LeaveGroupPayload = z.infer<typeof leaveGroupSchema>
