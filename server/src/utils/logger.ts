type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel]
}

function formatMessage(level: LogLevel, module: string, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString()
  const base = `${timestamp} [${level.toUpperCase()}] [${module}] ${message}`
  if (data !== undefined) {
    return `${base} ${JSON.stringify(data)}`
  }
  return base
}

export interface Logger {
  debug(message: string, data?: unknown): void
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

export function createLogger(module: string): Logger {
  return {
    debug(message: string, data?: unknown) {
      if (shouldLog('debug')) console.debug(formatMessage('debug', module, message, data))
    },
    info(message: string, data?: unknown) {
      if (shouldLog('info')) console.info(formatMessage('info', module, message, data))
    },
    warn(message: string, data?: unknown) {
      if (shouldLog('warn')) console.warn(formatMessage('warn', module, message, data))
    },
    error(message: string, data?: unknown) {
      if (shouldLog('error')) console.error(formatMessage('error', module, message, data))
    },
  }
}
