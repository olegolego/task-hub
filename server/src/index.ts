import { createServer } from './server.js'
import { getDataDir } from './db/database.js'
import { createLogger } from './utils/logger.js'
import { config } from './config.js'

const log = createLogger('main')

if (config.SKIP_SIG_VERIFY) {
  log.warn('SKIP_SIG_VERIFY is set but has no effect — signature verification is always enforced')
}

const protocol = config.TLS_CERT_PATH && config.TLS_KEY_PATH ? 'wss' : 'ws'

const server = createServer()
server.listen(config.PORT, () => {
  log.info(`Listening on ${protocol}://localhost:${config.PORT}`)
  log.info(`Data dir: ${getDataDir()}`)
})
