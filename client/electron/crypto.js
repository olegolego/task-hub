const nacl = require('tweetnacl')
const { encodeBase64, decodeBase64 } = require('tweetnacl-util')
const path = require('path')
const os = require('os')
const fs = require('fs')

const KEY_DIR = path.join(os.homedir(), '.taskmanager')
const PRIVATE_KEY_PATH = path.join(KEY_DIR, 'id_ed25519')
const PUBLIC_KEY_PATH = path.join(KEY_DIR, 'id_ed25519.pub')
const CONFIG_PATH = path.join(KEY_DIR, 'config.json')

function ensureKeyDir() {
  if (!fs.existsSync(KEY_DIR)) fs.mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 })
}

function generateKeypair() {
  ensureKeyDir()
  const kp = nacl.sign.keyPair()
  fs.writeFileSync(PRIVATE_KEY_PATH, encodeBase64(kp.secretKey), { mode: 0o600 })
  fs.writeFileSync(PUBLIC_KEY_PATH, encodeBase64(kp.publicKey))
  console.log('[Crypto] Generated new Ed25519 keypair at', KEY_DIR)
  return { publicKey: encodeBase64(kp.publicKey), secretKey: encodeBase64(kp.secretKey) }
}

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

function getOrCreateKeypair() {
  const existing = loadKeypair()
  if (existing) return existing
  const generated = generateKeypair()
  // Return in the same shape as loadKeypair
  const secretKey = decodeBase64(generated.secretKey)
  const publicKey = decodeBase64(generated.publicKey)
  return { secretKey, publicKey, publicKeyB64: generated.publicKey, secretKeyB64: generated.secretKey }
}

function signChallenge(challenge, secretKeyB64) {
  const secretKey = decodeBase64(secretKeyB64)
  const messageBytes = new TextEncoder().encode(challenge)
  const signature = nacl.sign.detached(messageBytes, secretKey)
  return encodeBase64(signature)
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {}
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) } catch { return {} }
}

function saveConfig(config) {
  ensureKeyDir()
  const current = loadConfig()
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...current, ...config }, null, 2))
}

module.exports = { getOrCreateKeypair, signChallenge, loadConfig, saveConfig, KEY_DIR }
