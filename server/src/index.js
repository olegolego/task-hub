const { createServer } = require('./server')

const PORT = process.env.PORT || 8765

// Skip signature verification in dev mode so client messages work without signing
process.env.SKIP_SIG_VERIFY = '1'

const server = createServer()
server.listen(PORT, () => {
  console.log(`[TaskHub Server] Listening on ws://localhost:${PORT}`)
  console.log(`[TaskHub Server] Data dir: ${require('./db/database').getDataDir()}`)
})
