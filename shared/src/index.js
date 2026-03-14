// Message types
const MESSAGE_TYPES = {
  // Tasks
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_COMPLETE: 'task:complete',
  TASK_DELETE: 'task:delete',
  TASK_ASSIGN: 'task:assign',
  // Ideas
  IDEA_POST: 'idea:post',
  IDEA_VOTE: 'idea:vote',
  IDEA_COMMENT: 'idea:comment',
  IDEA_STATUS: 'idea:status',
  // Groups
  GROUP_CREATE: 'group:create',
  GROUP_JOIN: 'group:join',
  GROUP_LEAVE: 'group:leave',
  // Presence
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  USER_STATUS: 'user:status',
  // Approval flow
  USER_PENDING: 'user:pending',
  USER_JOIN_PENDING: 'user:join_pending',
  USER_APPROVE: 'user:approve',
  USER_APPROVED: 'user:approved',
  // Direct messages (E2E encrypted with X25519 + XSalsa20-Poly1305)
  DM_SEND: 'dm:send',
  DM_RECEIVED: 'dm:received',
  DM_HISTORY: 'dm:history',
  DM_HISTORY_RESPONSE: 'dm:history_response',
  // System
  AUTH_CHALLENGE: 'auth:challenge',
  AUTH_RESPONSE: 'auth:response',
  AUTH_SUCCESS: 'auth:success',
  AUTH_FAIL: 'auth:fail',
  SYNC_REQUEST: 'sync:request',
  SYNC_RESPONSE: 'sync:response',
  ERROR: 'error',
}

// Priority levels
const PRIORITIES = {
  urgent: { label: 'Urgent', color: '#f72585' },
  high: { label: 'High', color: '#ef476f' },
  medium: { label: 'Medium', color: '#ffd166' },
  low: { label: 'Low', color: '#06d6a0' },
}

// Task statuses
const TASK_STATUS = {
  todo: 'todo',
  in_progress: 'in_progress',
  review: 'review',
  done: 'done',
}

// Idea statuses
const IDEA_STATUS = {
  open: 'open',
  discussed: 'discussed',
  accepted: 'accepted',
  archived: 'archived',
}

// User roles
const ROLES = {
  admin: 'admin',
  member: 'member',
  viewer: 'viewer',
}

// Group colors (auto-assigned)
const GROUP_COLORS = [
  '#4361ee', '#f72585', '#4cc9f0', '#06d6a0',
  '#ffd166', '#ef476f', '#7209b7', '#3a86a7',
]

module.exports = { MESSAGE_TYPES, PRIORITIES, TASK_STATUS, IDEA_STATUS, ROLES, GROUP_COLORS }
