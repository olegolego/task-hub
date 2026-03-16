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
  IDEA_DELETE: 'idea:delete',
  IDEA_DELETED: 'idea:deleted',
  // Groups
  GROUP_CREATE: 'group:create',
  GROUP_JOIN: 'group:join',
  GROUP_LEAVE: 'group:leave',
  GROUP_INVITE: 'group:invite',
  GROUP_INVITE_RECEIVED: 'group:invite_received',
  GROUP_INVITE_RESPOND: 'group:invite_respond',
  GROUP_JOIN_REQUESTED: 'group:join_requested',
  GROUP_JOIN_RESPOND: 'group:join_respond',
  GROUP_INVITED: 'group:invited',
  GROUP_MEMBERS: 'group:members',
  // Presence
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  USER_STATUS: 'user:status',
  USER_LIST: 'user:list',
  USER_LIST_RESPONSE: 'user:list_response',
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
  // LLM one-shot
  LLM_ASK: 'llm:ask',
  LLM_RESPONSE: 'llm:response',
  LLM_THINKING: 'llm:thinking',
  LLM_ERROR: 'llm:error',
  LLM_STATUS: 'llm:status',
  LLM_STATUS_RESPONSE: 'llm:status_response',
  // LLM chatbot
  LLM_CHAT: 'llm:chat',
  LLM_CHAT_RESPONSE: 'llm:chat_response',
  LLM_CHAT_NEW: 'llm:chat_new',
  LLM_CHAT_CREATED: 'llm:chat_created',
  LLM_CHAT_LIST: 'llm:chat_list',
  LLM_CHAT_LIST_RESPONSE: 'llm:chat_list_response',
  LLM_CHAT_HISTORY: 'llm:chat_history',
  LLM_CHAT_HISTORY_RESPONSE: 'llm:chat_history_response',
  LLM_CHAT_DELETE: 'llm:chat_delete',
  LLM_CHAT_DELETED: 'llm:chat_deleted',
  LLM_CHAT_RENAME: 'llm:chat_rename',
  LLM_CHAT_RENAMED: 'llm:chat_renamed',
  LLM_CONTEXT_LIST: 'llm:context_list',
  LLM_CONTEXT_LIST_RESPONSE: 'llm:context_list_response',
  LLM_FILES_LIST: 'llm:files_list',
  LLM_FILES_LIST_RESPONSE: 'llm:files_list_response',
  // Company files
  FILES_LIST: 'files:list',
  FILES_LIST_RESPONSE: 'files:list_response',
  FILES_DELETE: 'files:delete',
  FILES_DELETED: 'files:deleted',
  FILES_RENAME: 'files:rename',
  FILES_RENAMED: 'files:renamed',
  FILES_CREATE_FOLDER: 'files:create_folder',
  FILES_FOLDER_CREATED: 'files:folder_created',
  FILES_DELETE_FOLDER: 'files:delete_folder',
  FILES_FOLDER_DELETED: 'files:folder_deleted',
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
