import { z } from 'zod'

export const postIdeaSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  body: z.string().max(5000).optional(),
  groupId: z.string().optional(),
  category: z.string().max(100).optional().default('general'),
})

export const voteIdeaSchema = z.object({
  ideaId: z.string(),
  vote: z.union([z.literal(1), z.literal(-1)]),
})

export const commentIdeaSchema = z.object({
  ideaId: z.string(),
  body: z.string().min(1).max(5000),
})

export const updateIdeaStatusSchema = z.object({
  ideaId: z.string(),
  status: z.enum(['open', 'discussed', 'accepted', 'archived']),
})

export const deleteIdeaSchema = z.object({
  ideaId: z.string(),
})

export type PostIdeaPayload = z.infer<typeof postIdeaSchema>
export type VoteIdeaPayload = z.infer<typeof voteIdeaSchema>
export type CommentIdeaPayload = z.infer<typeof commentIdeaSchema>
export type UpdateIdeaStatusPayload = z.infer<typeof updateIdeaStatusSchema>
export type DeleteIdeaPayload = z.infer<typeof deleteIdeaSchema>
