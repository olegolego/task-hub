// @ts-nocheck
import { create } from 'zustand'

export const useConnectionStore = create((set, get) => ({
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
}))
