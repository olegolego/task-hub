export interface ElectronAPI {
  // Window controls
  minimizeWindow(): Promise<void>
  closeWindow(): Promise<void>
  togglePin(): Promise<boolean>
  getPinState(): Promise<boolean>

  // Config
  getConfig(): Promise<{ serverUrl?: string; displayName?: string }>
  saveConfig(config: { serverUrl?: string; displayName?: string }): Promise<{
    serverUrl?: string
    displayName?: string
  }>

  // Network
  sendMessage(msg: { type: string; payload?: unknown }): Promise<boolean>

  // Server message listener (returns cleanup fn)
  onMessage(handler: (msg: Record<string, any>) => void): () => void

  // Connection state listener (returns cleanup fn)
  onConnectionState(handler: (state: string) => void): () => void

  // Signal renderer is ready for replayed state
  notifyReady(): Promise<void>

  // Auth
  getPublicKey(): Promise<string>

  // Direct messages (E2E encrypted)
  sendDM(toUserId: string, text: string): Promise<{ ok: boolean; error?: string }>
  editDM(dmId: string, newText: string, toUserId: string): Promise<{ ok: boolean; error?: string }>
  loadDMHistory(withUserId: string, limit?: number): Promise<boolean>

  // File sharing (E2E encrypted)
  sendFileDM(toUserId: string): Promise<{ ok: boolean; canceled?: boolean; error?: string }>
  downloadFileDM(args: {
    fileId: string
    fileName: string
    encFileKey: string
    fileKeyNonce: string
    fromUserId: string
  }): Promise<{ ok: boolean; canceled?: boolean; savedTo?: string; error?: string }>

  // Company files (shared, not E2E encrypted)
  uploadCompanyFile(
    folder: string,
  ): Promise<{ ok: boolean; canceled?: boolean; fileId?: string; file?: unknown }>
  downloadCompanyFile(args: {
    fileId: string
    fileName: string
  }): Promise<{ ok: boolean; canceled?: boolean; error?: string }>

  // Focus input (sent from tray)
  onFocusInput(handler: () => void): () => void
}

declare global {
  interface Window {
    api?: ElectronAPI
  }
}
