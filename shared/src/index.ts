// Message types
export const MESSAGE_TYPES = {
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
  // File tokens
  FILE_TOKEN_REQUEST: 'file:token_request',
  FILE_TOKEN_RESPONSE: 'file:token_response',
  // System
  AUTH_CHALLENGE: 'auth:challenge',
  AUTH_RESPONSE: 'auth:response',
  AUTH_SUCCESS: 'auth:success',
  AUTH_FAIL: 'auth:fail',
  SYNC_REQUEST: 'sync:request',
  SYNC_RESPONSE: 'sync:response',
  ERROR: 'error',
} as const

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES]

// Priority levels
export const PRIORITIES = {
  urgent: { label: 'Urgent', color: '#f72585' },
  high: { label: 'High', color: '#ef476f' },
  medium: { label: 'Medium', color: '#ffd166' },
  low: { label: 'Low', color: '#06d6a0' },
} as const

export type PriorityKey = keyof typeof PRIORITIES

// Task statuses
export const TASK_STATUS = {
  todo: 'todo',
  in_progress: 'in_progress',
  review: 'review',
  done: 'done',
} as const

export type TaskStatusKey = keyof typeof TASK_STATUS

// Idea statuses
export const IDEA_STATUS = {
  open: 'open',
  discussed: 'discussed',
  accepted: 'accepted',
  archived: 'archived',
} as const

export type IdeaStatusKey = keyof typeof IDEA_STATUS

// User roles
export const ROLES = {
  admin: 'admin',
  member: 'member',
  viewer: 'viewer',
} as const

export type RoleKey = keyof typeof ROLES

// Group colors (auto-assigned)
export const GROUP_COLORS: readonly string[] = [
  '#4361ee',
  '#f72585',
  '#4cc9f0',
  '#06d6a0',
  '#ffd166',
  '#ef476f',
  '#7209b7',
  '#3a86a7',
]

// Re-export all types
export type { User, UserStatus } from './types/user.js'
export type { Task } from './types/task.js'
export type { Idea, IdeaVote, IdeaComment } from './types/idea.js'
export type { Group, GroupMember, GroupInvite, InviteType, InviteStatus } from './types/group.js'
export type { DirectMessage, GroupMessage, DMReaction } from './types/message.js'
export type { Meeting, MeetingAttendee, AttendeeStatus } from './types/meeting.js'
export type { FileRecord, CompanyFile, CompanyFolder } from './types/file.js'
export type { LLMChat, LLMMessage } from './types/llm.js'

// Re-export validation schemas
export {
  createTaskSchema,
  updateTaskSchema,
  completeTaskSchema,
  deleteTaskSchema,
  assignTaskSchema,
} from './validation/taskSchemas.js'
export {
  postIdeaSchema,
  voteIdeaSchema,
  commentIdeaSchema,
  updateIdeaStatusSchema,
  deleteIdeaSchema,
} from './validation/ideaSchemas.js'
export {
  createGroupSchema,
  inviteToGroupSchema,
  respondToInviteSchema,
  respondToJoinSchema,
  joinGroupSchema,
  leaveGroupSchema,
} from './validation/groupSchemas.js'
export {
  sendDMSchema,
  dmHistorySchema,
  editDMSchema,
  deleteDMSchema,
  reactDMSchema,
} from './validation/messageSchemas.js'
export {
  createMeetingSchema,
  rsvpMeetingSchema,
  deleteMeetingSchema,
} from './validation/meetingSchemas.js'
