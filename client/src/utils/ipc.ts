// Safe wrappers around window.api (available only in Electron)
const api = () => window.api

export const ipc = {
  // Window controls
  minimizeWindow: () => api()?.minimizeWindow(),
  closeWindow: () => api()?.closeWindow(),
  togglePin: () => api()?.togglePin() ?? Promise.resolve(true),
  getPinState: () => api()?.getPinState() ?? Promise.resolve(true),

  // Config
  getConfig: () =>
    api()?.getConfig() ?? Promise.resolve({} as { serverUrl?: string; displayName?: string }),
  saveConfig: (config: { serverUrl?: string; displayName?: string }) =>
    api()?.saveConfig(config) ?? Promise.resolve({}),

  // Network messaging
  sendMessage: (msg: { type: string; payload?: unknown }) =>
    api()?.sendMessage(msg) ?? Promise.resolve(false),

  // Auth
  getPublicKey: () => api()?.getPublicKey() ?? Promise.resolve(null),

  // Signal renderer is ready (replays state + sync from main)
  notifyReady: () => api()?.notifyReady() ?? Promise.resolve(),

  // Direct messages
  sendDM: (toUserId: string, text: string) =>
    api()?.sendDM(toUserId, text) ?? Promise.resolve({ ok: false }),
  editDM: (dmId: string, newText: string, toUserId: string) =>
    api()?.editDM(dmId, newText, toUserId) ?? Promise.resolve({ ok: false }),
  loadDMHistory: (withUserId: string, limit?: number) =>
    api()?.loadDMHistory(withUserId, limit) ?? Promise.resolve(false),

  // File sharing (E2E encrypted DMs)
  sendFileDM: (toUserId: string) => api()?.sendFileDM(toUserId) ?? Promise.resolve({ ok: false }),
  downloadFileDM: (args: {
    fileId: string
    fileName: string
    encFileKey: string
    fileKeyNonce: string
    fromUserId: string
  }) => api()?.downloadFileDM(args) ?? Promise.resolve({ ok: false, canceled: false }),

  // Company files (shared)
  uploadCompanyFile: (folder: string) =>
    api()?.uploadCompanyFile(folder) ?? Promise.resolve({ ok: false }),
  downloadCompanyFile: (args: { fileId: string; fileName: string }) =>
    api()?.downloadCompanyFile(args) ?? Promise.resolve({ ok: false }),

  // Subscriptions (return cleanup functions)
  onMessage: (handler: (msg: Record<string, any>) => void) =>
    api()?.onMessage(handler) ?? (() => {}),
  onConnectionState: (handler: (state: string) => void) =>
    api()?.onConnectionState(handler) ?? (() => {}),
  onFocusInput: (handler: () => void) => api()?.onFocusInput(handler) ?? (() => {}),
}
