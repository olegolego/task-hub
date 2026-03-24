// @ts-nocheck
import { create } from 'zustand'
import { ipc } from '../utils/ipc'

export const useFilesStore = create((set, get) => ({
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
