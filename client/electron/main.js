const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  dialog,
  Notification,
} = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')
const {
  getOrCreateKeypair,
  getOrCreateEncryptionKeypair,
  encryptDM,
  decryptDM,
  encryptFile,
  decryptFile,
  loadConfig,
  saveConfig,
} = require('./crypto')
const { createWsClient } = require('./wsClient')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow = null
let setupWindow = null
let tray = null
let isPinned = true
let wsClient = null

// Cache of userId → encPublicKey for DM encryption (populated from sync:response)
const encPubKeyCache = new Map()
// Cache userId → displayName for notifications
const userNameCache = new Map()
let myUserId = null

// ── Desktop notifications ────────────────────────────────────────────────────

function showNotification(title, body, onClick) {
  if (!Notification.isSupported()) return
  const notif = new Notification({ title, body, silent: false })
  notif.on('click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
    if (onClick) onClick()
  })
  notif.show()
  return notif
}

function shouldNotify(type) {
  const config = loadConfig()
  if (type === 'dm' && config.notifyDM === false) return false
  if (type === 'task' && config.notifyTask === false) return false
  if (type === 'meeting' && config.notifyMeeting === false) return false
  return true
}

// Last known connection state + last sync/auth messages — replayed when renderer comes online
let lastConnectionState = 'offline'
let lastAuthMessage = null
let lastSyncMessage = null

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
        lastAuthMessage = msg
      }

      // Cache enc public key when a user is approved
      if (msg.type === 'user:approved' && msg.user?.enc_public_key) {
        encPubKeyCache.set(msg.user.id, msg.user.enc_public_key)
      }

      // Cache enc public keys and display names from sync response
      if (msg.type === 'sync:response' && msg.data?.users) {
        for (const u of msg.data.users) {
          if (u.enc_public_key) encPubKeyCache.set(u.id, u.enc_public_key)
          if (u.display_name) userNameCache.set(u.id, u.display_name)
        }
        lastSyncMessage = msg
      }

      // Notifications for incoming DMs (only if window is not focused)
      if (msg.type === 'dm:received' && msg.dm && msg.dm.fromUserId !== myUserId) {
        const isWindowFocused = mainWindow?.isFocused()
        if (!isWindowFocused && shouldNotify('dm')) {
          const senderName = userNameCache.get(msg.dm.fromUserId) || 'Someone'
          const body = msg.dm.fileId
            ? 'Sent you a file'
            : msg.dm.text?.slice(0, 80) || 'New message'
          showNotification(`Message from ${senderName}`, body)
        }
      }

      // Notifications for task assignments
      if (
        msg.type === 'task:created' &&
        msg.task?.assigned_to === myUserId &&
        msg.task?.created_by !== myUserId
      ) {
        if (shouldNotify('task')) {
          const assignerName = userNameCache.get(msg.task.created_by) || 'Someone'
          showNotification(`Task assigned by ${assignerName}`, msg.task.title)
        }
      }
      if (msg.type === 'task:updated' && msg.task?.assigned_to === myUserId) {
        // Notify if newly assigned to me
        if (shouldNotify('task') && !mainWindow?.isFocused()) {
          showNotification('Task updated', msg.task.title)
        }
      }

      // Notifications for meeting invites
      if (msg.type === 'meeting:created' && msg.meeting) {
        const isAttendee = msg.meeting.attendees?.some((a) => a.userId === myUserId)
        if (isAttendee && msg.meeting.created_by !== myUserId && shouldNotify('meeting')) {
          const creatorName = userNameCache.get(msg.meeting.created_by) || 'Someone'
          showNotification(`Meeting from ${creatorName}`, msg.meeting.title)
        }
      }

      // Notification for group invites
      if (msg.type === 'group:invite_received') {
        const fromName = msg.fromName || 'Someone'
        showNotification(
          `Group invite from ${fromName}`,
          `Invited you to ${msg.groupName || 'a group'}`,
        )
      }

      // Notification for user approval (for the approved user)
      if (msg.type === 'user:approved' && !msg.userId) {
        showNotification('Access Approved', 'An admin has approved your account. Welcome!')
      }

      // Decrypt incoming DM before forwarding to renderer
      if (msg.type === 'dm:received' && msg.dm) {
        const dm = msg.dm
        if (dm.fileId) {
          // File DM — no text to decrypt, metadata is already plaintext
          delete dm.encrypted
          delete dm.nonce
        } else {
          const otherUserId = dm.fromUserId === myUserId ? dm.toUserId : dm.fromUserId
          const otherEncPubKey = encPubKeyCache.get(otherUserId)
          const myEncKeypair = getOrCreateEncryptionKeypair()
          if (otherEncPubKey && myEncKeypair) {
            dm.text =
              decryptDM(dm.encrypted, dm.nonce, otherEncPubKey, myEncKeypair.secretKeyB64) ??
              '[decryption failed]'
          } else {
            dm.text = '[missing encryption key]'
          }
          delete dm.encrypted
          delete dm.nonce
        }
      }

      // Decrypt edited DM before forwarding
      if (msg.type === 'dm:edited' && msg.dmId) {
        const otherUserId = msg.fromUserId === myUserId ? msg.toUserId : msg.fromUserId
        const otherEncPubKey = encPubKeyCache.get(otherUserId)
        const myEncKeypair = getOrCreateEncryptionKeypair()
        if (otherEncPubKey && myEncKeypair && msg.encrypted && msg.nonce) {
          msg.text =
            decryptDM(msg.encrypted, msg.nonce, otherEncPubKey, myEncKeypair.secretKeyB64) ??
            '[decryption failed]'
        }
        delete msg.encrypted
        delete msg.nonce
      }

      // Decrypt DM history before forwarding
      if (msg.type === 'dm:history_response' && msg.messages) {
        const myEncKeypair = getOrCreateEncryptionKeypair()
        for (const dm of msg.messages) {
          if (dm.fileId) {
            delete dm.encrypted
            delete dm.nonce
          } else {
            const otherUserId = dm.fromUserId === myUserId ? dm.toUserId : dm.fromUserId
            const otherEncPubKey = encPubKeyCache.get(otherUserId)
            if (otherEncPubKey && myEncKeypair) {
              dm.text =
                decryptDM(dm.encrypted, dm.nonce, otherEncPubKey, myEncKeypair.secretKeyB64) ??
                '[decryption failed]'
            } else {
              dm.text = '[missing encryption key]'
            }
            delete dm.encrypted
            delete dm.nonce
          }
        }
      }

      // Forward message to renderer
      mainWindow?.webContents.send('net:message', msg)
      setupWindow?.webContents.send('net:message', msg)
    },
    onState: (state) => {
      console.log('[Main] Connection state:', state)
      lastConnectionState = state
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

// Renderer calls this when it has finished mounting and registered all IPC listeners.
// We replay the last known state + auth/sync so it doesn't show stale "offline".
ipcMain.handle('renderer:ready', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    win.webContents.send('net:state', lastConnectionState)
    if (lastAuthMessage) win.webContents.send('net:message', lastAuthMessage)
    if (lastSyncMessage) win.webContents.send('net:message', lastSyncMessage)
  }
})

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

ipcMain.handle('dm:edit', (_, { dmId, newText, toUserId }) => {
  const recipientEncPubKey = encPubKeyCache.get(toUserId)
  if (!recipientEncPubKey) return { ok: false, error: 'No encryption key for recipient' }

  const myEncKeypair = getOrCreateEncryptionKeypair()
  const { encrypted, nonce } = encryptDM(newText, recipientEncPubKey, myEncKeypair.secretKeyB64)

  const sent = wsClient?.send({
    type: 'dm:edit',
    payload: { dmId, encrypted, nonce },
  })
  return { ok: !!sent }
})

ipcMain.handle('dm:history', (_, { withUserId, limit }) => {
  return (
    wsClient?.send({
      type: 'dm:history',
      payload: { withUserId, limit: limit ?? 50 },
    }) ?? false
  )
})

// ── IPC: File sharing ──────────────────────────────────────────────────────────

function getHttpBase() {
  const config = loadConfig()
  return (config.serverUrl || 'ws://localhost:8765').replace(/^ws/, 'http')
}

function httpPost(url, buffer, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': buffer.length,
          ...headers,
        },
      },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            reject(new Error(data))
          }
        })
      },
    )
    req.on('error', reject)
    req.write(buffer)
    req.end()
  })
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      })
      .on('error', reject)
  })
}

// Renderer asks to pick a file, encrypt it, upload, and send as a DM
ipcMain.handle('file:sendDM', async (_, { toUserId }) => {
  const recipientEncPubKey = encPubKeyCache.get(toUserId)
  if (!recipientEncPubKey) return { ok: false, error: 'No encryption key for recipient' }

  const result = await dialog.showOpenDialog({ properties: ['openFile'] })
  if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true }

  const filePath = result.filePaths[0]
  const fileName = path.basename(filePath)
  const fileBuffer = fs.readFileSync(filePath)
  const mimeType = guessMime(fileName)

  const myEncKeypair = getOrCreateEncryptionKeypair()
  const { blob, encFileKey, fileKeyNonce } = encryptFile(
    fileBuffer,
    recipientEncPubKey,
    myEncKeypair.secretKeyB64,
  )

  const base = getHttpBase()
  const uploadUrl = `${base}/upload?name=${encodeURIComponent(fileName)}&mime=${encodeURIComponent(mimeType)}&size=${fileBuffer.length}`
  const { fileId } = await httpPost(uploadUrl, blob, { 'X-User-Id': myUserId })

  const sent = wsClient?.send({
    type: 'dm:send',
    payload: {
      toUserId,
      fileId,
      fileName,
      fileSize: fileBuffer.length,
      mimeType,
      encFileKey,
      fileKeyNonce,
    },
  })
  return { ok: !!sent }
})

// Renderer asks to download and decrypt a file from a DM
ipcMain.handle(
  'file:downloadDM',
  async (_, { fileId, fileName, encFileKey, fileKeyNonce, fromUserId }) => {
    const senderEncPubKey = encPubKeyCache.get(fromUserId)
    if (!senderEncPubKey) return { ok: false, error: 'No encryption key for sender' }

    const saveResult = await dialog.showSaveDialog({ defaultPath: fileName })
    if (saveResult.canceled) return { ok: false, canceled: true }

    const base = getHttpBase()
    const blob = await httpGet(`${base}/files/${fileId}`)

    const myEncKeypair = getOrCreateEncryptionKeypair()
    const decrypted = decryptFile(
      blob,
      encFileKey,
      fileKeyNonce,
      senderEncPubKey,
      myEncKeypair.secretKeyB64,
    )
    if (!decrypted) return { ok: false, error: 'Decryption failed' }

    fs.writeFileSync(saveResult.filePath, decrypted)
    return { ok: true, savedTo: saveResult.filePath }
  },
)

// ── IPC: Company Files ────────────────────────────────────────────────────────

ipcMain.handle('company-file:upload', async (_, { folder }) => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'] })
  if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true }

  const filePath = result.filePaths[0]
  const fileName = path.basename(filePath)
  const fileBuffer = fs.readFileSync(filePath)
  const mimeType = guessMime(fileName)

  const base = getHttpBase()
  const uploadUrl = `${base}/company-upload?name=${encodeURIComponent(fileName)}&mime=${encodeURIComponent(mimeType)}&size=${fileBuffer.length}&folder=${encodeURIComponent(folder || 'General')}`
  const result2 = await httpPost(uploadUrl, fileBuffer, { 'X-User-Id': myUserId })
  return { ok: true, ...result2 }
})

ipcMain.handle('company-file:download', async (_, { fileId, fileName }) => {
  const saveResult = await dialog.showSaveDialog({ defaultPath: fileName })
  if (saveResult.canceled) return { ok: false, canceled: true }

  const base = getHttpBase()
  const buf = await httpGet(`${base}/company-files/${fileId}`)
  fs.writeFileSync(saveResult.filePath, buf)
  return { ok: true }
})

function guessMime(fileName) {
  const ext = path.extname(fileName).toLowerCase()
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.csv': 'text/csv',
  }
  return map[ext] || 'application/octet-stream'
}
