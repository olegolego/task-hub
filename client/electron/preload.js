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

  // Auth
  getPublicKey: () => ipcRenderer.invoke('auth:getPublicKey'),

  // Direct messages (E2E encrypted)
  sendDM: (toUserId, text) => ipcRenderer.invoke('dm:send', { toUserId, text }),
  loadDMHistory: (withUserId, limit) => ipcRenderer.invoke('dm:history', { withUserId, limit }),

  // Focus input (sent from tray)
  onFocusInput: (handler) => {
    ipcRenderer.on('focus-input', handler)
    return () => ipcRenderer.removeListener('focus-input', handler)
  },
})
