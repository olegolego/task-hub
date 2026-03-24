import { z } from 'zod'

export const createTaskSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  assignedTo: z.string().optional(),
  groupId: z.string().optional(),
  dueDate: z.string().optional(),
})

export const updateTaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(500).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  assignedTo: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
})

export const completeTaskSchema = z.object({
  id: z.string(),
  completed: z.boolean(),
})

export const deleteTaskSchema = z.object({
  id: z.string(),
})

export const assignTaskSchema = z.object({
  id: z.string(),
  assignedTo: z.string(),
})

export type CreateTaskPayload = z.infer<typeof createTaskSchema>
export type UpdateTaskPayload = z.infer<typeof updateTaskSchema>
export type CompleteTaskPayload = z.infer<typeof completeTaskSchema>
export type DeleteTaskPayload = z.infer<typeof deleteTaskSchema>
export type AssignTaskPayload = z.infer<typeof assignTaskSchema>
