const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut } = require('electron')
const path = require('path')
const { getOrCreateKeypair, getOrCreateEncryptionKeypair, encryptDM, decryptDM, loadConfig, saveConfig } = require('./crypto')
const { createWsClient } = require('./wsClient')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow = null
let setupWindow = null
let tray = null
let isPinned = true
let wsClient = null

// Cache of userId → encPublicKey for DM encryption (populated from sync:response)
const encPubKeyCache = new Map()
let myUserId = null

// ── Window creation ──────────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 620,
    minWidth: 320,
    maxWidth: 640,
    minHeight: 400,
    alwaysOnTop: true,
    frame: false,
    transparent: false,
    backgroundColor: '#1a1a2e',
    resizable: true,
    skipTaskbar: false,
    title: 'TaskHub',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.setAlwaysOnTop(true, 'floating')

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    console.error('[Main] Window failed to load:', errorCode, errorDescription)
  })


  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow.hide()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 440,
    height: 480,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#1a1a2e',
    title: 'TaskHub Setup',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (isDev) {
    setupWindow.loadURL('http://localhost:5173?setup=1')
  } else {
    setupWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { setup: '1' },
    })
  }

  setupWindow.on('closed', () => {
    setupWindow = null
  })
}

// ── Tray ─────────────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, '../assets/tray-icon.png')
  let icon
  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) icon = nativeImage.createEmpty()
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('TaskHub')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show / Hide', click: () => toggleWindowVisibility() },
    {
      label: 'Quick Add Task',
      click: () => {
        showWindow()
        mainWindow?.webContents.send('focus-input')
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => toggleWindowVisibility())
}

function showWindow() {
  if (!mainWindow) createMainWindow()
  mainWindow.show()
  mainWindow.focus()
}

function toggleWindowVisibility() {
  if (!mainWindow) return createMainWindow()
  if (mainWindow.isVisible()) mainWindow.hide()
  else showWindow()
}

// ── WebSocket management ──────────────────────────────────────────────────────

function startWsClient(serverUrl, displayName) {
  if (wsClient) wsClient.destroy()

  wsClient = createWsClient({
    serverUrl,
    displayName,
    onMessage: (msg) => {
      // Track own user ID from auth success
      if (msg.type === 'auth:success' && msg.user) {
        myUserId = msg.user.id
        if (msg.user.encPublicKey) encPubKeyCache.set(msg.user.id, msg.user.encPublicKey)
      }

      // Cache enc public keys from sync response
      if (msg.type === 'sync:response' && msg.data?.users) {
        for (const u of msg.data.users) {
          if (u.enc_public_key) encPubKeyCache.set(u.id, u.enc_public_key)
        }
      }

      // Decrypt incoming DM before forwarding to renderer
      if (msg.type === 'dm:received' && msg.dm) {
        const dm = msg.dm
        const otherUserId = dm.fromUserId === myUserId ? dm.toUserId : dm.fromUserId
        const otherEncPubKey = encPubKeyCache.get(otherUserId)
        const myEncKeypair = getOrCreateEncryptionKeypair()
        if (otherEncPubKey && myEncKeypair) {
          dm.text = decryptDM(dm.encrypted, dm.nonce, otherEncPubKey, myEncKeypair.secretKeyB64) ?? '[decryption failed]'
        } else {
          dm.text = '[missing encryption key]'
        }
        delete dm.encrypted
        delete dm.nonce
      }

      // Decrypt DM history before forwarding
      if (msg.type === 'dm:history_response' && msg.messages) {
        const myEncKeypair = getOrCreateEncryptionKeypair()
        for (const dm of msg.messages) {
          const otherUserId = dm.fromUserId === myUserId ? dm.toUserId : dm.fromUserId
          const otherEncPubKey = encPubKeyCache.get(otherUserId)
          if (otherEncPubKey && myEncKeypair) {
            dm.text = decryptDM(dm.encrypted, dm.nonce, otherEncPubKey, myEncKeypair.secretKeyB64) ?? '[decryption failed]'
          } else {
            dm.text = '[missing encryption key]'
          }
          delete dm.encrypted
          delete dm.nonce
        }
      }

      // Forward message to renderer
      mainWindow?.webContents.send('net:message', msg)
      setupWindow?.webContents.send('net:message', msg)
    },
    onState: (state) => {
      console.log('[Main] Connection state:', state)
      mainWindow?.webContents.send('net:state', state)
      setupWindow?.webContents.send('net:state', state)
    },
  })
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Ensure keypairs exist
  getOrCreateKeypair()
  getOrCreateEncryptionKeypair()

  const config = loadConfig()

  // If not configured, show setup window; otherwise show main
  if (!config.serverUrl || !config.displayName) {
    createSetupWindow()
  } else {
    createMainWindow()
    startWsClient(config.serverUrl, config.displayName)
  }

  createTray()

  globalShortcut.register('CommandOrControl+Shift+T', () => {
    toggleWindowVisibility()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (wsClient) wsClient.destroy()
})

app.on('window-all-closed', () => {
  // Keep alive in tray on all platforms
})

app.on('activate', () => {
  if (!mainWindow && !setupWindow) {
    const config = loadConfig()
    if (!config.serverUrl || !config.displayName) createSetupWindow()
    else createMainWindow()
  } else {
    showWindow()
  }
})

// ── IPC: Window controls ──────────────────────────────────────────────────────

ipcMain.handle('window:minimize', () => {
  mainWindow?.hide()
  setupWindow?.hide()
})

ipcMain.handle('window:close', () => {
  mainWindow?.hide()
  setupWindow?.hide()
})

ipcMain.handle('window:togglePin', () => {
  isPinned = !isPinned
  mainWindow?.setAlwaysOnTop(isPinned, 'floating')
  return isPinned
})

ipcMain.handle('window:getPin', () => isPinned)

// ── IPC: Config ───────────────────────────────────────────────────────────────

ipcMain.handle('config:get', () => loadConfig())

ipcMain.handle('config:save', (_, config) => {
  saveConfig(config)

  // If setup is complete, launch main window and start WS client
  const fullConfig = loadConfig()
  if (fullConfig.serverUrl && fullConfig.displayName) {
    if (!mainWindow) createMainWindow()
    else showWindow()

    startWsClient(fullConfig.serverUrl, fullConfig.displayName)

    // Close setup window after a short delay
    setTimeout(() => {
      setupWindow?.close()
    }, 300)
  }

  return fullConfig
})

// ── IPC: Network ──────────────────────────────────────────────────────────────

ipcMain.handle('net:send', (_, msg) => {
  if (!wsClient) return false
  return wsClient.send(msg)
})

// ── IPC: Auth ─────────────────────────────────────────────────────────────────

ipcMain.handle('auth:getPublicKey', () => {
  const kp = getOrCreateKeypair()
  return kp.publicKeyB64
})

// ── IPC: Direct Messages ──────────────────────────────────────────────────────

ipcMain.handle('dm:send', (_, { toUserId, text }) => {
  const recipientEncPubKey = encPubKeyCache.get(toUserId)
  if (!recipientEncPubKey) return { ok: false, error: 'No encryption key for recipient' }

  const myEncKeypair = getOrCreateEncryptionKeypair()
  const { encrypted, nonce } = encryptDM(text, recipientEncPubKey, myEncKeypair.secretKeyB64)

  const sent = wsClient?.send({
    type: 'dm:send',
    payload: { toUserId, encrypted, nonce },
  })
  return { ok: !!sent }
})

ipcMain.handle('dm:history', (_, { withUserId, limit }) => {
  return wsClient?.send({
    type: 'dm:history',
    payload: { withUserId, limit: limit ?? 50 },
  }) ?? false
})
