const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Tasks
  getTasks: () => ipcRenderer.invoke('tasks:get-all'),
  createTask: (data) => ipcRenderer.invoke('tasks:create', data),
  updateTask: (data) => ipcRenderer.invoke('tasks:update', data),
  deleteTask: (id) => ipcRenderer.invoke('tasks:delete', { id }),
  reorderTask: (id, newSortOrder) => ipcRenderer.invoke('tasks:reorder', { id, newSortOrder }),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (data) => ipcRenderer.invoke('settings:update', data),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  togglePin: () => ipcRenderer.invoke('window:toggle-pin'),
  getPinState: () => ipcRenderer.invoke('window:get-pin'),
})
