import type { PriorityKey } from '@task-hub/shared'

export const PRIORITIES = {
  urgent: { label: 'Urgent', color: '#f72585' },
  high: { label: 'High', color: '#ef476f' },
  medium: { label: 'Medium', color: '#ffd166' },
  low: { label: 'Low', color: '#06d6a0' },
} as const

export const PRIORITY_SYNTAX: Record<string, PriorityKey> = {
  '!urgent': 'urgent',
  '!u': 'urgent',
  '!high': 'high',
  '!h': 'high',
  '!med': 'medium',
  '!m': 'medium',
  '!low': 'low',
  '!l': 'low',
}

// Parse inline priority syntax from task title: "Buy milk !high" → { title: "Buy milk", priority: "high" }
export function parseTaskInput(raw: string): { title: string; priority: PriorityKey } {
  const input = raw.trim()
  for (const [token, priority] of Object.entries(PRIORITY_SYNTAX)) {
    if (input.toLowerCase().endsWith(' ' + token)) {
      return {
        title: input.slice(0, input.length - token.length - 1).trim(),
        priority,
      }
    }
  }
  return { title: input, priority: 'medium' }
}

export const NAV_PANELS = {
  TASKS: 'tasks',
  IDEAS: 'ideas',
  GROUPS: 'groups',
  PEOPLE: 'people',
  MESSAGES: 'messages',
  FILES: 'files',
  CALENDAR: 'calendar',
  LLM: 'llm',
} as const
