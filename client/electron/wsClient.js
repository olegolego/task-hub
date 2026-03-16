const WebSocket = require('ws')
const { v4: uuidv4 } = require('uuid')
const { getOrCreateKeypair, getOrCreateEncryptionKeypair, signChallenge, signMessage } = require('./crypto')

const RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT_DELAY_MS = 30000

/**
 * Creates a managed WebSocket client with automatic reconnection and Ed25519 auth.
 * @param {object} opts
 * @param {string} opts.serverUrl - WebSocket URL, e.g. ws://192.168.1.10:8765
 * @param {string} opts.displayName - User's display name for registration
 * @param {function} opts.onMessage - Called with parsed message objects from server
 * @param {function} opts.onState - Called with 'connecting' | 'authenticating' | 'connected' | 'offline'
 */
function createWsClient({ serverUrl, displayName, onMessage, onState }) {
  let ws = null
  let reconnectDelay = RECONNECT_DELAY_MS
  let reconnectTimer = null
  let destroyed = false
  let currentState = 'offline'
  let sendQueue = [] // messages queued while offline

  const keypair = getOrCreateKeypair()
  const encKeypair = getOrCreateEncryptionKeypair()

  function setState(state) {
    currentState = state
    onState(state)
  }

  function connect() {
    if (destroyed) return
    setState('connecting')
    console.log('[WsClient] Connecting to', serverUrl)

    try {
      ws = new WebSocket(serverUrl)
    } catch (err) {
      console.error('[WsClient] Failed to create WebSocket:', err.message)
      scheduleReconnect()
      return
    }

    ws.on('open', () => {
      console.log('[WsClient] Connected, waiting for auth challenge')
      setState('authenticating')
      reconnectDelay = RECONNECT_DELAY_MS // reset on successful open
    })

    ws.on('message', (data) => {
      let msg
      try {
        msg = JSON.parse(data.toString())
      } catch {
        console.error('[WsClient] Invalid JSON from server')
        return
      }

      // Handle auth challenge transparently
      if (msg.type === 'auth:challenge') {
        const signature = signChallenge(msg.challenge, keypair.secretKeyB64)
        const response = {
          type: 'auth:response',
          challenge: msg.challenge,
          publicKey: keypair.publicKeyB64,
          encPublicKey: encKeypair.publicKeyB64,
          signature,
          displayName,
        }
        ws.send(JSON.stringify(response))
        return
      }

      if (msg.type === 'auth:success') {
        setState('connected')
        console.log('[WsClient] Authenticated as', msg.user?.displayName)
        // Flush any messages queued while we were offline
        if (sendQueue.length > 0) {
          console.log(`[WsClient] Flushing ${sendQueue.length} queued messages`)
          for (const raw of sendQueue) ws.send(raw)
          sendQueue = []
        }
      }

      if (msg.type === 'auth:fail') {
        console.error('[WsClient] Auth failed:', msg.error)
        setState('offline')
        ws.close()
        return
      }

      // Forward all messages to caller
      onMessage(msg)
    })

    ws.on('close', () => {
      console.log('[WsClient] Disconnected')
      setState('offline')
      if (!destroyed) scheduleReconnect()
    })

    ws.on('error', (err) => {
      console.error('[WsClient] Error:', err.message)
      // 'close' event will fire after error
    })
  }

  function scheduleReconnect() {
    if (destroyed) return
    console.log(`[WsClient] Reconnecting in ${reconnectDelay}ms`)
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY_MS)
      connect()
    }, reconnectDelay)
  }

  function send(msg) {
    const signed = {
      ...msg,
      id: msg.id ?? uuidv4(),
      timestamp: msg.timestamp ?? Date.now(),
    }
    signed.signature = signMessage(signed, keypair.secretKeyB64)
    const raw = JSON.stringify(signed)

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(raw)
      return true
    }

    // Queue message to send once reconnected (skip read-only queries — they'll get fresh data on sync)
    const skipTypes = new Set(['task:list', 'files:list', 'meeting:list', 'llm:status', 'llm:chat_list', 'llm:chat_history', 'user:list'])
    if (!skipTypes.has(msg.type)) {
      sendQueue.push(raw)
      console.log(`[WsClient] Queued offline message: ${msg.type} (queue size: ${sendQueue.length})`)
    }
    return false
  }

  function destroy() {
    destroyed = true
    sendQueue = []
    clearTimeout(reconnectTimer)
    if (ws) {
      ws.removeAllListeners()
      ws.close()
      ws = null
    }
    setState('offline')
  }

  function getPublicKey() {
    return keypair.publicKeyB64
  }

  // Start connecting
  connect()

  return { send, destroy, getPublicKey, getEncKeypair: () => encKeypair, getState: () => currentState }
}

module.exports = { createWsClient }
