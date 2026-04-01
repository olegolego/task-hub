import { z } from 'zod'
import * as path from 'path'
import * as os from 'os'

const configSchema = z.object({
  PORT: z.coerce.number().default(8765),
  DATA_DIR: z.string().default(path.join(os.homedir(), '.taskmanager-server')),
  LLM_SERVER_URL: z.string().url().default('http://localhost:8766'),
  MAX_FILE_SIZE: z.coerce.number().default(50 * 1024 * 1024), // 50MB
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SKIP_SIG_VERIFY: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true'),
  CORS_ORIGINS: z.string().optional(),
  TLS_CERT_PATH: z.string().optional(),
  TLS_KEY_PATH: z.string().optional(),
})

export const config = configSchema.parse(process.env)
