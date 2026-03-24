import { createServer } from './server.js'
import { getDataDir } from './db/database.js'
import { createLogger } from './utils/logger.js'

const log = createLogger('main')

const PORT = process.env.PORT || 8765

const server = createServer()
server.listen(PORT, () => {
  log.info(`Listening on ws://localhost:${PORT}`)
  log.info(`Data dir: ${getDataDir()}`)
})
