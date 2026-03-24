import type { PriorityKey, TaskStatusKey } from '../index.js'

export interface Task {
  id: string
  title: string
  description?: string | null
  completed: number
  priority: PriorityKey
  status: TaskStatusKey
  created_by: string
  assigned_to?: string | null
  group_id?: string | null
  due_date?: string | null
  sort_order: number
  created_at: string
  updated_at: string
}
