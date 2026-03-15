const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  togglePin: () => ipcRenderer.invoke('window:togglePin'),
  getPinState: () => ipcRenderer.invoke('window:getPin'),

  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),

  // Network
  sendMessage: (msg) => ipcRenderer.invoke('net:send', msg),

  // Listen for messages from server (returns cleanup fn)
  onMessage: (handler) => {
    const listener = (_, msg) => handler(msg)
    ipcRenderer.on('net:message', listener)
    return () => ipcRenderer.removeListener('net:message', listener)
  },

  // Listen for connection state changes (returns cleanup fn)
  onConnectionState: (handler) => {
    const listener = (_, state) => handler(state)
    ipcRenderer.on('net:state', listener)
    return () => ipcRenderer.removeListener('net:state', listener)
  },

  // Signal that renderer is ready — main will replay last state + sync
  notifyReady: () => ipcRenderer.invoke('renderer:ready'),

  // Auth
  getPublicKey: () => ipcRenderer.invoke('auth:getPublicKey'),

  // Direct messages (E2E encrypted)
  sendDM: (toUserId, text) => ipcRenderer.invoke('dm:send', { toUserId, text }),
  editDM: (dmId, newText, toUserId) => ipcRenderer.invoke('dm:edit', { dmId, newText, toUserId }),
  loadDMHistory: (withUserId, limit) => ipcRenderer.invoke('dm:history', { withUserId, limit }),

  // File sharing (E2E encrypted — server never sees plaintext)
  sendFileDM: (toUserId) => ipcRenderer.invoke('file:sendDM', { toUserId }),
  downloadFileDM: (args) => ipcRenderer.invoke('file:downloadDM', args),

  // Company files (shared, not E2E encrypted)
  uploadCompanyFile: (folder) => ipcRenderer.invoke('company-file:upload', { folder }),
  downloadCompanyFile: (args) => ipcRenderer.invoke('company-file:download', args),

  // Focus input (sent from tray)
  onFocusInput: (handler) => {
    ipcRenderer.on('focus-input', handler)
    return () => ipcRenderer.removeListener('focus-input', handler)
  },
})
