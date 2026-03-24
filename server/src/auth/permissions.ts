import type Database from 'better-sqlite3'

export interface ClientInfo {
  id: string
  displayName: string
  role: string
  status: string
  avatarColor: string
  publicKey: string
  encPublicKey?: string | null
}

export function isGlobalAdmin(clientInfo: ClientInfo): boolean {
  return clientInfo.role === 'admin'
}

export function isGroupAdmin(db: Database.Database, userId: string, groupId: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND role = 'admin'")
    .get(groupId, userId) as { '1': number } | undefined
  return !!row
}

export function isGroupMember(db: Database.Database, userId: string, groupId: string): boolean {
  const row = db
    .prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?')
    .get(groupId, userId) as { '1': number } | undefined
  return !!row
}

export function canModifyTask(
  db: Database.Database,
  userId: string,
  task: { created_by: string; assigned_to?: string | null; group_id?: string | null },
  clientInfo: ClientInfo,
): boolean {
  if (isGlobalAdmin(clientInfo)) return true
  if (task.created_by === userId) return true
  if (task.assigned_to === userId) return true
  if (task.group_id && isGroupAdmin(db, userId, task.group_id)) return true
  return false
}

export function canDeleteResource(
  userId: string,
  createdBy: string,
  clientInfo: ClientInfo,
): boolean {
  return userId === createdBy || isGlobalAdmin(clientInfo)
}
