import { z } from 'zod'

export const createMeetingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  startTime: z.string(),
  endTime: z.string(),
  attendeeIds: z.array(z.string()).optional().default([]),
  groupId: z.string().nullable().optional().default(null),
})

export const rsvpMeetingSchema = z.object({
  meetingId: z.string(),
  status: z.enum(['accepted', 'declined']),
})

export const deleteMeetingSchema = z.object({
  meetingId: z.string(),
})

export type CreateMeetingPayload = z.infer<typeof createMeetingSchema>
export type RsvpMeetingPayload = z.infer<typeof rsvpMeetingSchema>
export type DeleteMeetingPayload = z.infer<typeof deleteMeetingSchema>
