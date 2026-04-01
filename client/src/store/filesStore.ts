import { create } from 'zustand'
import { ipc } from '../utils/ipc'
import type { CompanyFile } from '@task-hub/shared'

interface FilesStoreState {
  files: CompanyFile[]
  folders: string[]
  loading: boolean
}

interface FilesStoreActions {
  setFiles: (files: CompanyFile[]) => void
  setFolders: (folders: string[]) => void
  addFolder: (name: string) => void
  createFolder: (name: string) => void
  addFile: (file: CompanyFile) => void
  removeFile: (fileId: string) => void
  loadFiles: () => void
  deleteFile: (fileId: string) => void
  deleteFolder: (name: string) => void
  renameFile: (fileId: string, name: string) => void
  updateFileName: (fileId: string, name: string) => void
  removeFolder: (name: string) => void
  getFolders: () => string[]
}

export const useFilesStore = create<FilesStoreState & FilesStoreActions>()((set, get) => ({
  files: [],
  folders: [],
  loading: false,

  setFiles: (files) => set({ files }),

  setFolders: (folders) => set({ folders }),

  addFolder: (name) =>
    set((s) => ({
      folders: s.folders.includes(name) ? s.folders : [...s.folders, name],
    })),

  createFolder: (name) => {
    if (!name || !name.trim()) return
    get().addFolder(name.trim()) // optimistic update so folder appears immediately
    ipc.sendMessage({ type: 'files:create_folder', payload: { name: name.trim() } })
  },

  addFile: (file) =>
    set((s) => ({
      files: [file, ...s.files.filter((f) => f.id !== file.id)],
    })),

  removeFile: (fileId) =>
    set((s) => ({
      files: s.files.filter((f) => f.id !== fileId),
    })),

  loadFiles: () => {
    set({ loading: true })
    ipc.sendMessage({ type: 'files:list' })
  },

  deleteFile: (fileId) => {
    ipc.sendMessage({ type: 'files:delete', payload: { fileId } })
  },

  deleteFolder: (name) => {
    ipc.sendMessage({ type: 'files:delete_folder', payload: { name } })
  },

  renameFile: (fileId, name) => {
    set((s) => ({ files: s.files.map((f) => (f.id === fileId ? { ...f, name } : f)) }))
    ipc.sendMessage({ type: 'files:rename', payload: { fileId, name } })
  },

  updateFileName: (fileId, name) =>
    set((s) => ({
      files: s.files.map((f) => (f.id === fileId ? { ...f, name } : f)),
    })),

  removeFolder: (name) =>
    set((s) => ({
      folders: s.folders.filter((f) => f !== name),
      // Move files that were in this folder to General in local state
      files: s.files.map((f) => (f.folder === name ? { ...f, folder: 'General' } : f)),
    })),

  getFolders: () => {
    const { files, folders } = get()
    const fromFiles = files.map((f) => f.folder || 'General')
    return [...new Set([...folders, ...fromFiles])].sort()
  },
}))
