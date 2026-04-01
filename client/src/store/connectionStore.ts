import { create } from 'zustand'
import type { RoleKey, UserStatus } from '@task-hub/shared'

export type ConnectionState = 'connecting' | 'authenticating' | 'connected' | 'offline'

interface ConnectionStoreState {
  state: string
  serverUrl: string | null
  displayName: string | null
  myUserId: string | null
  myPublicKey: string | null
  myRole: RoleKey | null
  myStatus: UserStatus | null
}

interface ConnectionStoreActions {
  setState: (state: string) => void
  setServerUrl: (serverUrl: string) => void
  setDisplayName: (displayName: string) => void
  setMyUser: (user: {
    id: string
    displayName: string
    role?: RoleKey | null
    status?: UserStatus | null
  }) => void
  setMyPublicKey: (myPublicKey: string) => void
  setMyStatus: (myStatus: UserStatus) => void
  isConnected: () => boolean
}

export const useConnectionStore = create<ConnectionStoreState & ConnectionStoreActions>()(
  (set, get) => ({
    // 'connecting' | 'authenticating' | 'connected' | 'offline'
    state: 'offline',
    serverUrl: null,
    displayName: null,
    myUserId: null,
    myPublicKey: null,
    myRole: null,
    myStatus: null,

    setState: (state) => set({ state }),
    setServerUrl: (serverUrl) => set({ serverUrl }),
    setDisplayName: (displayName) => set({ displayName }),
    setMyUser: ({ id, displayName, role, status }) =>
      set({ myUserId: id, displayName, myRole: role ?? null, myStatus: status ?? 'active' }),
    setMyPublicKey: (myPublicKey) => set({ myPublicKey }),
    setMyStatus: (myStatus) => set({ myStatus }),

    isConnected: () => get().state === 'connected',
  }),
)
