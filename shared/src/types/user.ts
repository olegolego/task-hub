export type UserStatus = 'pending' | 'active' | 'disabled'
export type UserRole = 'admin' | 'member' | 'viewer'

export interface User {
  id: string
  public_key: string
  enc_public_key?: string | null
  display_name: string
  email?: string | null
  role: UserRole
  status: UserStatus
  avatar_color?: string | null
  created_at: string
  last_seen_at?: string | null
}
