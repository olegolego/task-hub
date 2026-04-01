// @ts-check
/** @typedef {{ secretKey: Uint8Array; publicKey: Uint8Array; publicKeyB64: string; secretKeyB64: string }} Keypair */
/** @typedef {{ encrypted: string; nonce: string }} EncryptedDM */
/** @typedef {{ blob: Buffer; encFileKey: string; fileKeyNonce: string }} EncryptedFile */
/** @typedef {{ serverUrl?: string; displayName?: string }} AppConfig */

const nacl = require('tweetnacl')
const { encodeBase64, decodeBase64 } = require('tweetnacl-util')
const path = require('path')
const os = require('os')
const fs = require('fs')

/** @type {string} */
const KEY_DIR = process.env.TASKMANAGER_CONFIG_DIR || path.join(os.homedir(), '.taskmanager')
const PRIVATE_KEY_PATH = path.join(KEY_DIR, 'id_ed25519')
const PUBLIC_KEY_PATH = path.join(KEY_DIR, 'id_ed25519.pub')
const ENC_PRIVATE_KEY_PATH = path.join(KEY_DIR, 'id_x25519')
const ENC_PUBLIC_KEY_PATH = path.join(KEY_DIR, 'id_x25519.pub')
const CONFIG_PATH = path.join(KEY_DIR, 'config.json')

function ensureKeyDir() {
  if (!fs.existsSync(KEY_DIR)) fs.mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 })
}

/** @returns {{ publicKey: string; secretKey: string }} */
function generateKeypair() {
  ensureKeyDir()
  const kp = nacl.sign.keyPair()
  fs.writeFileSync(PRIVATE_KEY_PATH, encodeBase64(kp.secretKey), { mode: 0o600 })
  fs.writeFileSync(PUBLIC_KEY_PATH, encodeBase64(kp.publicKey))
  console.log('[Crypto] Generated new Ed25519 keypair at', KEY_DIR)
  return { publicKey: encodeBase64(kp.publicKey), secretKey: encodeBase64(kp.secretKey) }
}

/** @returns {Keypair | null} */
function loadKeypair() {
  if (!fs.existsSync(PRIVATE_KEY_PATH)) return null
  try {
    const secretKeyB64 = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8').trim()
    const publicKeyB64 = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8').trim()
    const secretKey = decodeBase64(secretKeyB64)
    const publicKey = decodeBase64(publicKeyB64)
    return { secretKey, publicKey, publicKeyB64, secretKeyB64 }
  } catch (err) {
    console.error('[Crypto] Failed to load keypair:', err)
    return null
  }
}

/** @returns {Keypair} */
function getOrCreateKeypair() {
  const existing = loadKeypair()
  if (existing) return existing
  const generated = generateKeypair()
  // Return in the same shape as loadKeypair
  const secretKey = decodeBase64(generated.secretKey)
  const publicKey = decodeBase64(generated.publicKey)
  return {
    secretKey,
    publicKey,
    publicKeyB64: generated.publicKey,
    secretKeyB64: generated.secretKey,
  }
}

/**
 * @param {string} challenge
 * @param {string} secretKeyB64
 * @returns {string}
 */
function signChallenge(challenge, secretKeyB64) {
  const secretKey = decodeBase64(secretKeyB64)
  const messageBytes = new TextEncoder().encode(challenge)
  const signature = nacl.sign.detached(messageBytes, secretKey)
  return encodeBase64(signature)
}

/**
 * Sign an outgoing message body (id + type + payload + timestamp)
 * @param {{ id: string; type: string; payload?: unknown; timestamp: number }} msg
 * @param {string} secretKeyB64
 * @returns {string}
 */
function signMessage(msg, secretKeyB64) {
  const secretKey = decodeBase64(secretKeyB64)
  const body = JSON.stringify({
    id: msg.id,
    type: msg.type,
    payload: msg.payload,
    timestamp: msg.timestamp,
  })
  const messageBytes = new TextEncoder().encode(body)
  const signature = nacl.sign.detached(messageBytes, secretKey)
  return encodeBase64(signature)
}

// ── X25519 encryption keypair (for DMs) ──────────────────────────────────────

/** @returns {Keypair} */
function getOrCreateEncryptionKeypair() {
  if (fs.existsSync(ENC_PRIVATE_KEY_PATH)) {
    try {
      const secretKeyB64 = fs.readFileSync(ENC_PRIVATE_KEY_PATH, 'utf8').trim()
      const publicKeyB64 = fs.readFileSync(ENC_PUBLIC_KEY_PATH, 'utf8').trim()
      return {
        secretKey: decodeBase64(secretKeyB64),
        publicKey: decodeBase64(publicKeyB64),
        publicKeyB64,
        secretKeyB64,
      }
    } catch {}
  }
  ensureKeyDir()
  const kp = nacl.box.keyPair()
  fs.writeFileSync(ENC_PRIVATE_KEY_PATH, encodeBase64(kp.secretKey), { mode: 0o600 })
  fs.writeFileSync(ENC_PUBLIC_KEY_PATH, encodeBase64(kp.publicKey))
  console.log('[Crypto] Generated new X25519 encryption keypair')
  return {
    secretKey: kp.secretKey,
    publicKey: kp.publicKey,
    publicKeyB64: encodeBase64(kp.publicKey),
    secretKeyB64: encodeBase64(kp.secretKey),
  }
}

// Encrypt a DM using nacl.box (X25519 ECDH + XSalsa20-Poly1305).
// Both parties share the same ECDH secret, so either can decrypt any message
// in the conversation using (otherParty.encPubKey, myEncSecKey).
/**
 * @param {string} text
 * @param {string} recipientEncPubKeyB64
 * @param {string} myEncSecKeyB64
 * @returns {EncryptedDM}
 */
function encryptDM(text, recipientEncPubKeyB64, myEncSecKeyB64) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const messageBytes = new TextEncoder().encode(text)
  const encrypted = nacl.box(
    messageBytes,
    nonce,
    decodeBase64(recipientEncPubKeyB64),
    decodeBase64(myEncSecKeyB64),
  )
  return { encrypted: encodeBase64(encrypted), nonce: encodeBase64(nonce) }
}

// Decrypt a DM. Pass the OTHER party's enc public key regardless of message direction.
/**
 * @param {string} encryptedB64
 * @param {string} nonceB64
 * @param {string} otherPartyEncPubKeyB64
 * @param {string} myEncSecKeyB64
 * @returns {string | null}
 */
function decryptDM(encryptedB64, nonceB64, otherPartyEncPubKeyB64, myEncSecKeyB64) {
  try {
    const decrypted = nacl.box.open(
      decodeBase64(encryptedB64),
      decodeBase64(nonceB64),
      decodeBase64(otherPartyEncPubKeyB64),
      decodeBase64(myEncSecKeyB64),
    )
    if (!decrypted) return null
    return new TextDecoder().decode(decrypted)
  } catch {
    return null
  }
}

// ── File encryption (nacl.secretbox + key wrapped with nacl.box) ──────────────
// Files are encrypted symmetrically with a random 32-byte key (XSalsa20-Poly1305).
// That key is then sealed with nacl.box (ECDH) so only the recipient can open it.
// The server stores only the opaque encrypted blob — it is server-blind.

/**
 * @param {Buffer | Uint8Array} fileBuffer
 * @param {string} recipientEncPubKeyB64
 * @param {string} myEncSecKeyB64
 * @returns {EncryptedFile}
 */
function encryptFile(fileBuffer, recipientEncPubKeyB64, myEncSecKeyB64) {
  const fileKey = nacl.randomBytes(nacl.secretbox.keyLength) // random 256-bit symmetric key
  const fileNonce = nacl.randomBytes(nacl.secretbox.nonceLength) // random 192-bit nonce
  const ciphertext = nacl.secretbox(new Uint8Array(fileBuffer), fileNonce, fileKey)

  // Store nonce prepended to ciphertext so the recipient can find it
  const blob = Buffer.concat([Buffer.from(fileNonce), Buffer.from(ciphertext)])

  // Seal the file key for the recipient with nacl.box (ECDH shared secret)
  const keyNonce = nacl.randomBytes(nacl.box.nonceLength)
  const encFileKey = nacl.box(
    fileKey,
    keyNonce,
    decodeBase64(recipientEncPubKeyB64),
    decodeBase64(myEncSecKeyB64),
  )

  return {
    blob, // encrypted file bytes (nonce prepended)
    encFileKey: encodeBase64(encFileKey),
    fileKeyNonce: encodeBase64(keyNonce),
  }
}

/**
 * Also seal the file key for ourselves so we can re-read our own sent files
 * @param {Buffer | Uint8Array} fileBuffer
 * @param {string} myEncPubKeyB64
 * @param {string} myEncSecKeyB64
 * @returns {EncryptedFile}
 */
function encryptFileForSelf(fileBuffer, myEncPubKeyB64, myEncSecKeyB64) {
  return encryptFile(fileBuffer, myEncPubKeyB64, myEncSecKeyB64)
}

/**
 * @param {Buffer | Uint8Array} blobBuffer
 * @param {string} encFileKeyB64
 * @param {string} fileKeyNonceB64
 * @param {string} otherPartyEncPubKeyB64
 * @param {string} myEncSecKeyB64
 * @returns {Buffer | null}
 */
function decryptFile(
  blobBuffer,
  encFileKeyB64,
  fileKeyNonceB64,
  otherPartyEncPubKeyB64,
  myEncSecKeyB64,
) {
  try {
    const fileKey = nacl.box.open(
      decodeBase64(encFileKeyB64),
      decodeBase64(fileKeyNonceB64),
      decodeBase64(otherPartyEncPubKeyB64),
      decodeBase64(myEncSecKeyB64),
    )
    if (!fileKey) return null

    const blobBytes = new Uint8Array(blobBuffer)
    const fileNonce = blobBytes.slice(0, nacl.secretbox.nonceLength)
    const ciphertext = blobBytes.slice(nacl.secretbox.nonceLength)
    const plaintext = nacl.secretbox.open(ciphertext, fileNonce, fileKey)
    if (!plaintext) return null
    return Buffer.from(plaintext)
  } catch {
    return null
  }
}

/** @returns {AppConfig} */
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {}
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  } catch {
    return {}
  }
}

/** @param {Partial<AppConfig>} config */
function saveConfig(config) {
  ensureKeyDir()
  const current = loadConfig()
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...current, ...config }, null, 2))
}

module.exports = {
  getOrCreateKeypair,
  getOrCreateEncryptionKeypair,
  encryptDM,
  decryptDM,
  encryptFile,
  encryptFileForSelf,
  decryptFile,
  signChallenge,
  signMessage,
  loadConfig,
  saveConfig,
  KEY_DIR,
}
