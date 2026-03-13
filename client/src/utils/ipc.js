// Safe wrappers around window.api (available only in Electron)
const api = () => window.api

export const ipc = {
  // Window controls
  minimizeWindow: () => api()?.minimizeWindow(),
  closeWindow: () => api()?.closeWindow(),
  togglePin: () => api()?.togglePin() ?? Promise.resolve(true),
  getPinState: () => api()?.getPinState() ?? Promise.resolve(true),

  // Config
  getConfig: () => api()?.getConfig() ?? Promise.resolve({}),
  saveConfig: (config) => api()?.saveConfig(config) ?? Promise.resolve({}),

  // Network messaging
  sendMessage: (msg) => api()?.sendMessage(msg) ?? Promise.resolve(false),

  // Auth
  getPublicKey: () => api()?.getPublicKey() ?? Promise.resolve(null),

  // Subscriptions (return cleanup functions)
  onMessage: (handler) => api()?.onMessage(handler) ?? (() => {}),
  onConnectionState: (handler) => api()?.onConnectionState(handler) ?? (() => {}),
  onFocusInput: (handler) => api()?.onFocusInput(handler) ?? (() => {}),
}
