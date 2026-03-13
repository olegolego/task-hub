import { create } from 'zustand'

export const useConnectionStore = create((set, get) => ({
  // 'connecting' | 'authenticating' | 'connected' | 'offline'
  state: 'offline',
  serverUrl: null,
  displayName: null,
  myUserId: null,
  myPublicKey: null,

  setState: (state) => set({ state }),
  setServerUrl: (serverUrl) => set({ serverUrl }),
  setDisplayName: (displayName) => set({ displayName }),
  setMyUser: ({ id, displayName }) => set({ myUserId: id, displayName }),
  setMyPublicKey: (myPublicKey) => set({ myPublicKey }),

  isConnected: () => get().state === 'connected',
}))
