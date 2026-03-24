import { describe, it, expect } from 'vitest'
import {
  createTaskSchema,
  updateTaskSchema,
  completeTaskSchema,
  postIdeaSchema,
  voteIdeaSchema,
  createGroupSchema,
  sendDMSchema,
  createMeetingSchema,
} from '@task-hub/shared'

describe('Task validation schemas', () => {
  it('validates a valid task creation payload', () => {
    const result = createTaskSchema.safeParse({
      title: 'Buy groceries',
      priority: 'high',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Buy groceries')
      expect(result.data.priority).toBe('high')
    }
  })

  it('rejects empty title', () => {
    const result = createTaskSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('defaults priority to medium', () => {
    const result = createTaskSchema.safeParse({ title: 'Test' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe('medium')
    }
  })

  it('rejects invalid priority', () => {
    const result = createTaskSchema.safeParse({ title: 'Test', priority: 'critical' })
    expect(result.success).toBe(false)
  })

  it('validates task update with partial fields', () => {
    const result = updateTaskSchema.safeParse({ id: 'abc', title: 'Updated' })
    expect(result.success).toBe(true)
  })

  it('validates task complete', () => {
    const result = completeTaskSchema.safeParse({ id: 'abc', completed: true })
    expect(result.success).toBe(true)
  })
})

describe('Idea validation schemas', () => {
  it('validates a valid idea', () => {
    const result = postIdeaSchema.safeParse({ title: 'New feature idea' })
    expect(result.success).toBe(true)
  })

  it('validates vote with 1 or -1', () => {
    expect(voteIdeaSchema.safeParse({ ideaId: 'x', vote: 1 }).success).toBe(true)
    expect(voteIdeaSchema.safeParse({ ideaId: 'x', vote: -1 }).success).toBe(true)
    expect(voteIdeaSchema.safeParse({ ideaId: 'x', vote: 2 }).success).toBe(false)
  })
})

describe('Group validation schemas', () => {
  it('validates group creation', () => {
    const result = createGroupSchema.safeParse({ name: 'Engineering' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createGroupSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

describe('DM validation schemas', () => {
  it('validates text DM', () => {
    const result = sendDMSchema.safeParse({
      toUserId: 'user123',
      encrypted: 'base64data',
      nonce: 'nonce123',
    })
    expect(result.success).toBe(true)
  })

  it('validates file DM', () => {
    const result = sendDMSchema.safeParse({
      toUserId: 'user123',
      fileId: 'file-uuid',
    })
    expect(result.success).toBe(true)
  })

  it('rejects DM without text or file', () => {
    const result = sendDMSchema.safeParse({
      toUserId: 'user123',
    })
    expect(result.success).toBe(false)
  })
})

describe('Meeting validation schemas', () => {
  it('validates meeting creation', () => {
    const result = createMeetingSchema.safeParse({
      title: 'Standup',
      startTime: '2026-03-25T09:00:00Z',
      endTime: '2026-03-25T09:30:00Z',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.attendeeIds).toEqual([])
      expect(result.data.groupId).toBeNull()
    }
  })

  it('rejects missing title', () => {
    const result = createMeetingSchema.safeParse({
      startTime: '2026-03-25T09:00:00Z',
      endTime: '2026-03-25T09:30:00Z',
    })
    expect(result.success).toBe(false)
  })
})
