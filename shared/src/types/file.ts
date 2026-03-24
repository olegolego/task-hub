export interface FileRecord {
  id: string
  original_name: string
  size: number
  mime_type?: string | null
  stored_path: string
  uploaded_by: string
  created_at: string
}

export interface CompanyFile {
  id: string
  name: string
  size: number
  mime_type?: string | null
  folder: string
  stored_path: string
  uploaded_by: string
  created_at: string
}

export interface CompanyFolder {
  name: string
  created_by?: string | null
  created_at: string
}
