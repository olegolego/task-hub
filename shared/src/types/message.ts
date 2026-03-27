export interface DirectMessage {
  id: string
  from_user: string
  to_user: string
  encrypted: string
  nonce: string
  created_at: string
  deleted_at?: string | null
  edited_at?: string | null
  file_id?: string | null
  file_name?: string | null
  file_size?: number | null
  mime_type?: string | null
  enc_file_key?: string | null
  file_key_nonce?: string | null
}

export interface GroupMessage {
  id: string
  group_id: string
  from_user_id: string
  body: string
  created_at: string
}

export interface DMReaction {
  dm_id: string
  user_id: string
  emoji: string
}
