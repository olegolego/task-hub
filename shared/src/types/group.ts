export type GroupMemberRole = 'admin' | 'member'
export type InviteType = 'invite' | 'join_request'
export type InviteStatus = 'pending' | 'accepted' | 'declined'

export interface Group {
  id: string
  name: string
  description?: string | null
  created_by: string
  color?: string | null
  created_at: string
}

export interface GroupMember {
  group_id: string
  user_id: string
  role: GroupMemberRole
  joined_at: string
}

export interface GroupInvite {
  id: string
  group_id: string
  from_user_id: string
  to_user_id: string
  type: InviteType
  status: InviteStatus
  created_at: string
}
