import { z } from 'zod'

export const sendDMSchema = z
  .object({
    toUserId: z.string(),
    encrypted: z.string().optional(),
    nonce: z.string().optional(),
    fileId: z.string().optional(),
    fileName: z.string().max(500).optional(),
    fileSize: z.number().int().positive().optional(),
    mimeType: z.string().max(200).optional(),
    encFileKey: z.string().optional(),
    fileKeyNonce: z.string().optional(),
  })
  .refine((data) => data.encrypted || data.fileId, {
    message: 'Either encrypted text or fileId must be provided',
  })

export const dmHistorySchema = z.object({
  withUserId: z.string(),
  limit: z.number().int().min(1).max(200).optional().default(50),
  before: z.string().optional(),
})

export const editDMSchema = z.object({
  dmId: z.string(),
  encrypted: z.string(),
  nonce: z.string(),
})

export const deleteDMSchema = z.object({
  dmId: z.string(),
})

export const reactDMSchema = z.object({
  dmId: z.string(),
  emoji: z.string().min(1).max(20),
})

export type SendDMPayload = z.infer<typeof sendDMSchema>
export type DMHistoryPayload = z.infer<typeof dmHistorySchema>
export type EditDMPayload = z.infer<typeof editDMSchema>
export type DeleteDMPayload = z.infer<typeof deleteDMSchema>
export type ReactDMPayload = z.infer<typeof reactDMSchema>
